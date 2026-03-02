import os
import httpx
import logging
import asyncio
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AsaasIntegration")

app = FastAPI(title="Payment Microservice (Asaas API v3)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ASAAS_API_KEY = os.getenv("ASAAS_API_KEY")
ASAAS_API_URL = os.getenv("ASAAS_API_URL", "https://api.asaas.com/v3")

if not ASAAS_API_KEY:
    logger.critical("⚠️ ASAAS_API_KEY não configurada! O serviço não conseguirá transacionar.")

processed_webhooks = set()

class CreditCardInfo(BaseModel):
    holderName: str
    number: str
    expiryMonth: str
    expiryYear: str
    ccv: str

class CreditCardHolder(BaseModel):
    name: str
    email: str
    cpfCnpj: str
    postalCode: str
    addressNumber: str
    addressComplement: Optional[str] = None
    phone: str
    mobilePhone: str

class PaymentRequest(BaseModel):
    name: str # Novo: para auto-criar cliente
    email: str # Novo
    cpf: str # Novo
    value: float
    billing_type: str
    external_reference: str
    description: Optional[str] = "Cobrança gerada pelo SaaS"
    credit_card: Optional[CreditCardInfo] = None
    credit_card_holder_info: Optional[CreditCardHolder] = None

class WebhookPayload(BaseModel):
    id: str
    event: str
    payment: Dict[str, Any]

async def asaas_request(method: str, endpoint: str, payload: dict = None):
    headers = {
        "access_token": ASAAS_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "MinhaSaaS/1.0.0"
    }
    url = f"{ASAAS_API_URL}{endpoint}"
    
    async with httpx.AsyncClient() as client:
        try:
            if method == "POST":
                response = await client.post(url, json=payload, headers=headers, timeout=12.0)
            elif method == "GET":
                response = await client.get(url, headers=headers, timeout=12.0)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Erro na API Asaas [{e.response.status_code}]: {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Network Error / Asaas Indisponível: {str(e)}")
            raise HTTPException(status_code=503, detail="O provedor de pagamento está temporariamente indisponível.")

async def get_or_create_customer(name: str, email: str, cpf: str):
    res = await asaas_request("GET", f"/customers?cpfCnpj={cpf}")
    if res.get("data") and len(res["data"]) > 0:
        return res["data"][0]["id"]
    
    new_cus = await asaas_request("POST", "/customers", {
        "name": name,
        "email": email,
        "cpfCnpj": cpf
    })
    return new_cus["id"]

@app.post("/api/v1/payments")
async def create_payment(req: PaymentRequest):
    logger.info(f"Nova ordem de faturamento | Ref: {req.external_reference} | Tipo: {req.billing_type}")
    
    customer_id = await get_or_create_customer(req.name, req.email, req.cpf)
    
    payload = {
        "customer": customer_id,
        "billingType": req.billing_type,
        "value": req.value,
        "dueDate": "2024-12-31", 
        "externalReference": req.external_reference,
        "description": req.description,
    }

    if req.billing_type == "CREDIT_CARD":
        if not req.credit_card or not req.credit_card_holder_info:
            raise HTTPException(status_code=400, detail="Transação de cartão exige 'credit_card' e infos do titular.")
        
        payload["creditCard"] = req.credit_card.dict()
        payload["creditCardHolderInfo"] = req.credit_card_holder_info.dict()
        
        payment_resp = await asaas_request("POST", "/payments", payload)
        return {"status": "success", "payment": payment_resp}

    elif req.billing_type == "PIX":
        payment_resp = await asaas_request("POST", "/payments", payload)
        payment_id = payment_resp.get("id")
        
        pix_resp = await asaas_request("GET", f"/payments/{payment_id}/pixQrCode")
        
        return {
            "status": "success",
            "payment": payment_resp,
            "pix": {
                "encodedImage": pix_resp.get("encodedImage"),
                "payload": pix_resp.get("payload")
            }
        }
    
    else:
        raise HTTPException(status_code=400, detail="billing_type inválido. Tipos aceitos: PIX | CREDIT_CARD.")

@app.get("/api/v1/payments/{payment_id}/status")
async def get_payment_status(payment_id: str):
    logger.info(f"Consultando status do pagamento: {payment_id}")
    payment_resp = await asaas_request("GET", f"/payments/{payment_id}")
    return {"status": "success", "payment": payment_resp}

@app.post("/api/v1/webhooks/asaas")
async def asaas_webhook(payload: WebhookPayload, request: Request):
    event_id = payload.id
    event_type = payload.event
    payment_data = payload.payment
    external_ref = payment_data.get("externalReference")
    
    if event_id in processed_webhooks:
        return {"status": "ignored", "reason": "already_processed"}
    
    logger.info(f"Webhook Recebido: [ {event_type} ] | SaaS Ref: {external_ref} | Asaas ID: {payment_data.get('id')}")
    
    try:
        processed_webhooks.add(event_id)
        return {"status": "success", "event": event_type}
        
    except Exception as e:
        logger.error(f"Erro Crítico de DB ao processar Payload {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal DB Sync Error")
