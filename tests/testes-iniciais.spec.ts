import { test, expect } from '@playwright/test';

test('Validação de interface básica e carregamento', async ({ page }) => {
  // O servidor de produção (serve) está rodando na porta 3000
  await page.goto('http://localhost:3000');

  // Verifica se o título da página está presente e não deu erro de rotas vazias
  const content = await page.content();
  expect(content.length).toBeGreaterThan(100);

  // Vamos tentar acessar a tela de login
  await page.goto('http://localhost:3000/login');
  
  // Verifica se os campos de email e senha apareceram
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  
  // Vamos também validar a acessibilidade básica na tela de login
  const button = page.locator('button[type="submit"]');
  await expect(button).toBeVisible();
});
