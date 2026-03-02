import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, endOfMonth, format, differenceInYears, parseISO } from "date-fns";

// ─── Shared: fetch all plans for duration lookup ────────────
async function fetchPlanMap(): Promise<Record<number, number>> {
  const { data } = await supabase.from("subscription_plans").select("price, duration_months");
  const map: Record<number, number> = {};
  for (const p of data ?? []) {
    map[Number(p.price)] = p.duration_months;
  }
  return map;
}

function getDuration(price: number, planMap: Record<number, number>): number {
  return planMap[price] ?? 1; // default to monthly
}

// ─── KPIs ───────────────────────────────────────────────────

export function useMRR() {
  return useQuery({
    queryKey: ["admin-mrr"],
    queryFn: async () => {
      const [{ data, error }, planMap] = await Promise.all([
        supabase.from("subscriptions").select("plan_price").eq("status", "active"),
        fetchPlanMap(),
      ]);
      if (error) throw error;
      // MRR = sum of (plan_price / duration_months) for each active subscription
      let mrr = 0;
      for (const r of data ?? []) {
        const price = Number(r.plan_price);
        const dur = getDuration(price, planMap);
        mrr += price / dur;
      }
      const count = data?.length ?? 0;
      return { mrr: Math.round(mrr * 100) / 100, arpu: count > 0 ? Math.round((mrr / count) * 100) / 100 : 0, activeCount: count };
    },
  });
}

export function useChurnRate() {
  return useQuery({
    queryKey: ["admin-churn"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const prevMonthStart = startOfMonth(subMonths(now, 1));

      // Active at start of month = active now + canceled this month
      const { count: canceledThisMonth } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "canceled")
        .gte("canceled_at", monthStart.toISOString());

      const { count: activeNow } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const canceled = canceledThisMonth ?? 0;
      const active = activeNow ?? 0;
      const startActive = active + canceled;
      const rate = startActive > 0 ? (canceled / startActive) * 100 : 0;

      return { churnRate: Math.round(rate * 10) / 10, canceledThisMonth: canceled };
    },
  });
}

export function useChurnReasons() {
  return useQuery({
    queryKey: ["admin-churn-reasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("cancel_reason")
        .not("canceled_at", "is", null);
      if (error) throw error;

      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of data ?? []) {
        const reason = r.cancel_reason || "Outros";
        counts[reason] = (counts[reason] || 0) + 1;
        total++;
      }
      return Object.entries(counts)
        .map(([reason, count]) => ({ reason, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => b.pct - a.pct);
    },
  });
}

// ─── Revenue History (6 months) ─────────────────────────────

export function useRevenueHistory() {
  return useQuery({
    queryKey: ["admin-revenue-history"],
    queryFn: async () => {
      const months: { month: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({
          month: format(d, "MMM"),
          start: startOfMonth(d),
          end: endOfMonth(d),
        });
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_price, started_at, canceled_at, status");
      if (error) throw error;

      return months.map(({ month, start, end }) => {
        let receita = 0;
        for (const sub of data ?? []) {
          const startedAt = new Date(sub.started_at);
          const canceledAt = sub.canceled_at ? new Date(sub.canceled_at) : null;
          // Was active during this month?
          if (startedAt <= end && (!canceledAt || canceledAt >= start)) {
            receita += Number(sub.plan_price);
          }
        }
        return { month, receita, meta: 0 };
      });
    },
  });
}

// ─── Retention ──────────────────────────────────────────────

export function useRetentionHistory() {
  return useQuery({
    queryKey: ["admin-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("started_at, canceled_at, status");
      if (error) throw error;

      const months: { month: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({ month: format(d, "MMM"), start: startOfMonth(d), end: endOfMonth(d) });
      }

      return months.map(({ month, start, end }) => {
        let activeStart = 0;
        let activeEnd = 0;
        for (const sub of data ?? []) {
          const s = new Date(sub.started_at);
          const c = sub.canceled_at ? new Date(sub.canceled_at) : null;
          if (s <= start && (!c || c >= start)) activeStart++;
          if (s <= end && (!c || c >= end)) activeEnd++;
        }
        const retention = activeStart > 0 ? Math.round((activeEnd / activeStart) * 100) : 100;
        return { month, retention };
      });
    },
  });
}

// ─── CAC ────────────────────────────────────────────────────

export function useCAC() {
  return useQuery({
    queryKey: ["admin-cac"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);

      const { data: spend } = await supabase
        .from("marketing_spend")
        .select("amount")
        .gte("month", format(monthStart, "yyyy-MM-dd"))
        .lte("month", format(now, "yyyy-MM-dd"));

      const totalSpend = (spend ?? []).reduce((s, r) => s + Number(r.amount), 0);

      const { count: newUsers } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .gte("started_at", monthStart.toISOString());

      const users = newUsers ?? 0;
      const cac = users > 0 ? totalSpend / users : 0;

      return { cac: Math.round(cac * 100) / 100, totalSpend, newUsers: users };
    },
  });
}

// ─── TCV (Total Contract Value) ─────────────────────────────

export function useTCV() {
  return useQuery({
    queryKey: ["admin-tcv"],
    queryFn: async () => {
      // Use invites as source of truth for sales (closers create invites, not subscriptions)
      const [{ data: invites, error: invErr }, { data: plans }] = await Promise.all([
        supabase.from("invites").select("plan_value, payment_status, status, subscription_plan_id, created_at"),
        supabase.from("subscription_plans").select("id, name, price, duration_months").eq("active", true),
      ]);
      if (invErr) throw invErr;

      const planById: Record<string, { name: string; duration_months: number; price: number }> = {};
      for (const p of plans ?? []) {
        planById[p.id] = { name: p.name, duration_months: p.duration_months, price: Number(p.price) };
      }

      // Consider used invites (activated accounts) as valid contracts
      const validInvites = (invites ?? []).filter(
        (i) => i.status === "used" || i.payment_status === "paid" || i.payment_status === "confirmed"
      );

      let tcv = 0;
      const planBreakdown: Record<string, { count: number; totalValue: number; duration: number }> = {};

      for (const inv of validInvites) {
        const value = Number(inv.plan_value) || 0;
        if (value <= 0) continue;

        const plan = inv.subscription_plan_id ? planById[inv.subscription_plan_id] : null;
        const planName = plan?.name ?? `Plano R$ ${value}`;
        const duration = plan?.duration_months ?? 1;

        tcv += value;

        if (!planBreakdown[planName]) {
          planBreakdown[planName] = { count: 0, totalValue: 0, duration };
        }
        planBreakdown[planName].count++;
        planBreakdown[planName].totalValue += value;
      }

      const breakdown = Object.entries(planBreakdown)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue);

      return { tcv, breakdown, totalContracts: validInvites.filter(i => (Number(i.plan_value) || 0) > 0).length };
    },
  });
}

export type PeriodFilter = "1m" | "3m" | "6m" | "12m" | "all";

function getMonthsForPeriod(period: PeriodFilter): number {
  switch (period) {
    case "1m": return 1;
    case "3m": return 3;
    case "6m": return 6;
    case "12m": return 12;
    case "all": return 60; // 5 years max
  }
}

export function useKpiHistory(period: PeriodFilter = "6m") {
  const numMonths = getMonthsForPeriod(period);
  return useQuery({
    queryKey: ["admin-kpi-history", period],
    queryFn: async () => {
      const [{ data, error }, planMap, { data: invites }] = await Promise.all([
        supabase.from("subscriptions").select("plan_price, started_at, canceled_at, status"),
        fetchPlanMap(),
        supabase.from("invites").select("plan_value, payment_status, status, created_at")
          .or("status.eq.used,payment_status.eq.paid,payment_status.eq.confirmed"),
      ]);
      if (error) throw error;

      const subs = data ?? [];
      const validInvites = (invites ?? []).filter(i => (Number(i.plan_value) || 0) > 0);

      // For "1m" period, generate weekly data points
      if (period === "1m") {
        return generateWeeklyData(subs, planMap, validInvites);
      }

      // For "all", find earliest subscription
      let effectiveMonths = numMonths;
      if (period === "all" && subs.length > 0) {
        const earliest = subs.reduce((min, s) => {
          const d = new Date(s.started_at);
          return d < min ? d : min;
        }, new Date());
        const diffMs = new Date().getTime() - earliest.getTime();
        effectiveMonths = Math.max(1, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)));
      }

      const months: { label: string; monthKey: string; start: Date; end: Date }[] = [];
      for (let i = effectiveMonths - 1; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({
          label: format(d, "MMM/yy"),
          monthKey: format(d, "yyyy-MM"),
          start: startOfMonth(d),
          end: endOfMonth(d),
        });
      }

      return months.map(({ label, monthKey, start, end }) => {
        let mrr = 0;
        let activeStart = 0;
        let canceledInMonth = 0;

        for (const sub of subs) {
          const s = new Date(sub.started_at);
          const c = sub.canceled_at ? new Date(sub.canceled_at) : null;

          if (s <= end && (!c || c >= start)) {
            const price = Number(sub.plan_price);
            const dur = getDuration(price, planMap);
            mrr += price / dur;
          }
          if (s <= start && (!c || c >= start)) {
            activeStart++;
          }
          if (c && c >= start && c <= end) {
            canceledInMonth++;
          }
        }

        const churn = activeStart > 0 ? Math.round((canceledInMonth / activeStart) * 100 * 10) / 10 : 0;
        const arpu = activeStart > 0 ? mrr / activeStart : 0;
        const ltv = churn > 0 ? Math.round(arpu / (churn / 100)) : 0;

        // TCV from invites (cumulative up to this month)
        let tcv = 0;
        for (const inv of validInvites) {
          const invDate = new Date(inv.created_at);
          if (invDate <= end) {
            tcv += Number(inv.plan_value);
          }
        }

        return { month: label, monthKey, mrr: Math.round(mrr), churn, ltv, tcv };
      });
    },
  });
}
function generateWeeklyData(subs: any[], planMap: Record<number, number>, validInvites: any[]) {
  const now = new Date();
  const weeks: { label: string; monthKey: string; start: Date; end: Date }[] = [];
  
  for (let i = 4; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    
    const weekLabel = `Sem ${5 - i}`;
    weeks.push({
      label: weekLabel,
      monthKey: format(weekEnd, "yyyy-MM"),
      start: weekStart,
      end: weekEnd,
    });
  }

  return weeks.map(({ label, monthKey, start, end }) => {
    let mrr = 0;
    let activeStart = 0;
    let canceledInWeek = 0;

    for (const sub of subs) {
      const s = new Date(sub.started_at);
      const c = sub.canceled_at ? new Date(sub.canceled_at) : null;

      if (s <= end && (!c || c >= start)) {
        const price = Number(sub.plan_price);
        const dur = getDuration(price, planMap);
        mrr += price / dur;
      }
      if (s <= start && (!c || c >= start)) {
        activeStart++;
      }
      if (c && c >= start && c <= end) {
        canceledInWeek++;
      }
    }

    const churn = activeStart > 0 ? Math.round((canceledInWeek / activeStart) * 100 * 10) / 10 : 0;
    const arpu = activeStart > 0 ? mrr / activeStart : 0;
    const ltv = churn > 0 ? Math.round(arpu / (churn / 100)) : 0;

    let tcv = 0;
    for (const inv of validInvites) {
      const invDate = new Date(inv.created_at);
      if (invDate <= end) {
        tcv += Number(inv.plan_value);
      }
    }

    return { month: label, monthKey, mrr: Math.round(mrr), churn, ltv, tcv };
  });
}

// ─── Acquisition channels ───────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  "Indicação": "hsl(0,100%,27%)",
  "Instagram": "hsl(280,60%,50%)",
  "YouTube": "hsl(0,80%,50%)",
  "Google": "hsl(210,70%,50%)",
  "Outros": "hsl(43,76%,53%)",
};

export function useAcquisitionChannels() {
  return useQuery({
    queryKey: ["admin-acquisition"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("como_chegou")
        .not("como_chegou", "is", null);
      if (error) throw error;

      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of data ?? []) {
        const ch = r.como_chegou || "Outros";
        counts[ch] = (counts[ch] || 0) + 1;
        total++;
      }

      const colorKeys = Object.keys(CHANNEL_COLORS);
      let colorIdx = 0;

      return Object.entries(counts)
        .map(([source, count]) => ({
          source,
          value: total > 0 ? Math.round((count / total) * 100) : 0,
          color: CHANNEL_COLORS[source] || `hsl(${(colorIdx++ * 60) % 360},50%,50%)`,
        }))
        .sort((a, b) => b.value - a.value);
    },
  });
}

// ─── Normalization maps ─────────────────────────────────────

const OBJECTIVE_MAP: Record<string, string> = {
  "massa": "Massa Muscular",
  "Massa muscular": "Massa Muscular",
  "Ganho de massa muscular": "Massa Muscular",
  "Perda de gordura": "Perda de Gordura",
  "gordura": "Perda de Gordura",
  "Deixo para os profissionais avaliarem a melhor abordagem": "A critério do profissional",
  "profissionais": "A critério do profissional",
  "Outro (próxima pergunta)": "A critério do profissional",
  "outro": "A critério do profissional",
};

function normalizeObjective(raw: string): string {
  return OBJECTIVE_MAP[raw] ?? OBJECTIVE_MAP[raw.toLowerCase()] ?? raw;
}

const ACTIVITY_MAP: Record<string, string> = {
  "sedentario": "Sedentário",
  "sedentário": "Sedentário",
  "moderado": "Moderado",
  "ativo": "Ativo",
};

function normalizeActivity(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (ACTIVITY_MAP[lower]) return ACTIVITY_MAP[lower];
  if (lower.includes("sedentário") || lower.includes("sedentario")) return "Sedentário";
  if (lower.includes("moderadamente")) return "Moderado";
  if (lower.includes("fisicamente ativo") || lower.includes("muito ativo")) return "Ativo";
  return raw;
}

const FAIXA_ETARIA_MAP: Record<string, string> = {
  "18 a 24 anos": "18-24",
  "25 a 29 anos": "25-34",
  "30 a 34 anos": "25-34",
  "35 a 39 anos": "35-44",
  "40 a 44 anos": "35-44",
  "45 a 49 anos": "45-54",
  "50 a 54 anos": "45-54",
  "55 a 59 anos": "55+",
  "60 anos ou mais": "55+",
};

function calcAgeFromString(nascimento: string): number | null {
  let date: Date;
  if (nascimento.includes("/")) {
    const parts = nascimento.split("/");
    if (parts.length === 3) {
      date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else return null;
  } else {
    date = parseISO(nascimento);
  }
  if (isNaN(date.getTime())) return null;
  return differenceInYears(new Date(), date);
}

// ─── Demographics (anamnese + profiles) ─────────────────────

export function useDemographics() {
  return useQuery({
    queryKey: ["admin-demographics"],
    queryFn: async () => {
      const [anamneseRes, profilesRes] = await Promise.all([
        supabase.from("anamnese").select("objetivo, experiencia_treino, restricoes_alimentares, dados_extras"),
        supabase.from("profiles").select("nascimento, faixa_etaria"),
      ]);

      if (anamneseRes.error) throw anamneseRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const anamnese = anamneseRes.data ?? [];
      const profiles = profilesRes.data ?? [];

      // Objectives — normalized
      const objCounts: Record<string, number> = {};
      let objTotal = 0;
      for (const a of anamnese) {
        if (a.objetivo) {
          const normalized = normalizeObjective(a.objetivo);
          objCounts[normalized] = (objCounts[normalized] || 0) + 1;
          objTotal++;
        }
      }
      const objColors = ["hsl(0,100%,27%)", "hsl(43,76%,53%)", "hsl(210,70%,50%)", "hsl(140,60%,40%)", "hsl(280,60%,50%)"];
      const objectiveData = Object.entries(objCounts)
        .map(([name, count], i) => ({ name, value: objTotal > 0 ? Math.round((count / objTotal) * 100) : 0, color: objColors[i % objColors.length] }))
        .sort((a, b) => b.value - a.value);

      // Age groups — prioritize faixa_etaria, fallback to nascimento with DD/MM/YYYY support
      const ageBuckets: Record<string, number> = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0 };
      for (const p of profiles) {
        if (p.faixa_etaria && FAIXA_ETARIA_MAP[p.faixa_etaria]) {
          ageBuckets[FAIXA_ETARIA_MAP[p.faixa_etaria]]++;
          continue;
        }
        if (!p.nascimento) continue;
        const age = calcAgeFromString(p.nascimento);
        if (age === null || age < 18) continue;
        if (age <= 24) ageBuckets["18-24"]++;
        else if (age <= 34) ageBuckets["25-34"]++;
        else if (age <= 44) ageBuckets["35-44"]++;
        else if (age <= 54) ageBuckets["45-54"]++;
        else ageBuckets["55+"]++;
      }
      const ageData = Object.entries(ageBuckets).map(([faixa, total]) => ({ faixa, total }));

      // Experience — use dados_extras.nivel_atividade
      const expCounts: Record<string, number> = {};
      let expTotal = 0;
      for (const a of anamnese) {
        const extras = a.dados_extras as Record<string, any> | null;
        const nivel = extras?.nivel_atividade;
        if (nivel && typeof nivel === "string") {
          const normalized = normalizeActivity(nivel);
          expCounts[normalized] = (expCounts[normalized] || 0) + 1;
          expTotal++;
        }
      }
      const expColors = ["hsl(43,76%,53%)", "hsl(210,70%,50%)", "hsl(0,100%,27%)"];
      const experienceData = Object.entries(expCounts)
        .map(([name, count], i) => ({ name, value: expTotal > 0 ? Math.round((count / expTotal) * 100) : 0, color: expColors[i % expColors.length] }))
        .sort((a, b) => b.value - a.value);

      // Dietary restrictions
      const resCounts: Record<string, number> = {};
      let resTotal = 0;
      for (const a of anamnese) {
        const val = a.restricoes_alimentares || "Sem restrição";
        resCounts[val] = (resCounts[val] || 0) + 1;
        resTotal++;
      }
      const restricoesData = Object.entries(resCounts)
        .map(([restricao, count]) => ({ restricao, pct: resTotal > 0 ? Math.round((count / resTotal) * 100) : 0 }))
        .sort((a, b) => b.pct - a.pct);

      return { objectiveData, ageData, experienceData, restricoesData };
    },
  });
}
