import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRelatorioPerformance } from "@/hooks/useRelatorioPerformance";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, LineChart as LineChartIcon, Brain, Dumbbell, AlertTriangle, CheckCircle, Info, Sun, Moon, ChevronDown, Activity, LayoutGrid, List, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, LabelList, AreaChart, Area, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const formatDateBR = (val: string) => {
  if (!val || typeof val !== "string" || !val.includes("-")) return val;
  const [y, m, d] = val.split("-");
  if (!y || !m || !d) return val;
  return `${d}/${m}/${y}`;
};

const insightIcons = {
  positive: <CheckCircle className="text-emerald-400" size={16} />,
  negative: <AlertTriangle className="text-destructive" size={16} />,
  warning: <AlertTriangle className="text-amber-400" size={16} />,
  neutral: <Info className="text-blue-400" size={16} />
};

const insightColors = {
  positive: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  negative: "bg-destructive/10 border-destructive/20 text-destructive",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  neutral: "bg-blue-500/10 border-blue-500/20 text-blue-400"
};

const EspecialistaRelatorio = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  // Specialist Students for the dropdown
  const { data: students } = useSpecialistStudents();

  // Control the month natively with a single Date object
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const startDate = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const endDate = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), [currentMonth]);

  const [isLightMode, setIsLightMode] = useState(false);
  const [isStackedLayout, setIsStackedLayout] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const tc = isLightMode ? "text-slate-900" : "text-foreground";
  const mutec = isLightMode ? "text-slate-500" : "text-muted-foreground";
  const bgc = isLightMode ? "bg-white border-slate-200" : "bg-card border-border";

  const {
    studentInfo,
    workouts,
    workoutDays,
    checkins,
    mentalAverages,
    volumeDetalhado,
    volumeResumido,
    progressionData,
    weightHistory,
    insights,
    isLoading
  } = useRelatorioPerformance(studentId!, startDate, endDate);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!searchQuery) return students;
    return students.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [students, searchQuery]);

  const [selectedWorkout, setSelectedWorkout] = useState<any | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    const prevLight = isLightMode;
    setIsLightMode(true);
    toast.loading("Gerando PDF...", { id: "pdf-export" });
    try {
      // small delay to let theme apply
      await new Promise((r) => setTimeout(r, 250));
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const pageH = 297;
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      const nome = (studentInfo?.name || "aluno").replace(/\s+/g, "-").toLowerCase();
      const mes = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
      pdf.save(`relatorio-${nome}-${mes}.pdf`);
      toast.success("PDF exportado!", { id: "pdf-export" });
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar PDF", { id: "pdf-export" });
    } finally {
      setIsLightMode(prevLight);
      setIsExporting(false);
    }
  };

  if (!selectedExercise && progressionData && progressionData.length > 0) {
    setSelectedExercise(progressionData[0].name);
  }

  const handleDayClick = (day: Date, modifiers: any) => {
    if (modifiers.hasWorkout && workouts) {
      const dayStr = day.toISOString().split('T')[0];
      const dayWorkouts = workouts.filter((w: any) => w.started_at.startsWith(dayStr));
      if (dayWorkouts.length > 0) {
        setSelectedWorkout(dayWorkouts[0]);
      }
    }
  };

  const currentProgression = progressionData?.find(p => p.name === selectedExercise);

  // Parse mental checkins for area chart
  const mentalChartData = useMemo(() => {
    if (!checkins) return [];
    return checkins.map(c => ({
      date: new Date(c.created_at).toISOString().split('T')[0],
      sleep: Number(c.sleep_hours || 0),
      mood: Number(c.mood || 0),
      stress: Number(c.stress || 0),
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [checkins]);

  if (isLoading && !workouts) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLightMode ? "bg-slate-50" : "bg-background"}`}>
        <p className={`${mutec} animate-pulse font-cinzel tracking-widest uppercase`}>Gerando Relatório...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-2 sm:p-4 transition-colors duration-300`} style={isLightMode ? { backgroundColor: "#f8f9fa" } : { backgroundColor: "hsl(var(--background))" }}>
      {/* Container is completely unconstrained for max horizontal stretch and tight vertical gaps */}
      <div ref={reportRef} className="w-full space-y-4 flex flex-col">

        
        {/* Header - Very compact */}
        <div className={`flex flex-col md:flex-row items-center justify-between gap-4 p-3 rounded-lg border shadow-sm w-full ${bgc}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 border shadow-sm ${isLightMode ? 'bg-slate-200 border-slate-300' : 'bg-secondary border-border'}`}>
              {studentInfo?.avatar_url ? (
                <img src={studentInfo.avatar_url} alt={studentInfo.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${mutec}`}>
                  <LineChartIcon size={20} />
                </div>
              )}
            </div>
            <div>
              <h1 className={`font-cinzel text-lg font-bold flex items-center gap-2 ${tc} leading-tight`}>
                Relatório de Performance
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:underline outline-none mt-0.5">
                  {studentInfo?.name || "Desconhecido"} <ChevronDown size={12} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-80 flex flex-col p-2">
                  <div className="pb-2 mb-1 border-b">
                    <input 
                      type="text" 
                      placeholder="Pesquisar aluno..." 
                      className={`w-full px-2 py-1.5 text-sm rounded-md border outline-none transition-colors ${isLightMode ? 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-secondary/50 border-border text-foreground focus:border-primary'}`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredStudents?.length === 0 ? (
                      <p className={`text-xs text-center py-3 ${mutec}`}>Nenhum aluno encontrado</p>
                    ) : (
                      filteredStudents?.map(s => (
                        <DropdownMenuItem key={s.id} onClick={() => navigate(`/especialista/relatorio/${s.id}`)}>
                          {s.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-2 rounded-lg border bg-amber-500 hover:bg-amber-600 disabled:opacity-60 border-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Exportar relatório em PDF"
            >
              <Download size={14} />
              {isExporting ? "Gerando..." : "Exportar PDF"}
            </button>
            <button onClick={() => setIsStackedLayout(!isStackedLayout)} className={`p-2 rounded-lg border transition-colors ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-secondary/50 hover:bg-secondary border-border text-foreground'}`} title={isStackedLayout ? "Visão Dividida" : "Visão Empilhada"}>
              {isStackedLayout ? <LayoutGrid size={16} /> : <List size={16} />}
            </button>
            <button onClick={() => setIsLightMode(!isLightMode)} className={`p-2 rounded-lg border transition-colors ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-secondary/50 hover:bg-secondary border-border text-foreground'}`} title="Alternar Tema">
              {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>

        {/* 1. Volume and Progression Chart - Super compact vertical size */}
        <div className={`grid grid-cols-1 ${isStackedLayout ? '' : 'lg:grid-cols-2'} gap-4 w-full`}>
          {/* Volume Chart */}
          <div className={`rounded-xl border p-4 space-y-2 shadow-sm flex flex-col ${bgc}`}>
            <div>
              <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 mb-0.5 ${tc}`}>
                <Dumbbell size={16} className="text-amber-500" /> Volume por Agrupamento
              </h2>
              <p className={`text-[11px] ${mutec}`}>Total de séries finalizadas no mês.</p>
            </div>
            
            <div className="w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeDetalhado} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="grupo" width={90} interval={0} tick={{ fill: isLightMode ? '#475569' : '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: isLightMode ? '#e2e8f0' : 'hsl(var(--secondary)/0.5)' }}
                    contentStyle={{ backgroundColor: isLightMode ? '#fff' : 'hsl(var(--card))', border: isLightMode ? '1px solid #cbd5e1' : '1px solid hsl(var(--border))', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }}
                  />
                  <Bar dataKey="series" radius={[0, 4, 4, 0]} minPointSize={2} barSize={12}>
                    {volumeDetalhado?.map((entry, index) => {
                      const minMonthly = 34;
                      const maxMonthly = 86;
                      const actual = entry.series;
                      
                      let fillColor = '#f97316'; // default orange
                      if (actual < minMonthly - 10) fillColor = '#ef4444'; // Red
                      else if (actual > maxMonthly + 15) fillColor = '#ef4444'; // Red
                      else if (actual >= minMonthly && actual <= maxMonthly) fillColor = '#10b981'; // Green
                      else fillColor = '#fbbf24'; // Yellow

                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                    <LabelList 
                      dataKey="series" 
                      position="right" 
                      formatter={(val: number) => `${val} s`}
                      style={{ fill: isLightMode ? '#475569' : '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Load Progression Chart */}
          <div className={`rounded-xl border p-4 space-y-2 shadow-sm flex flex-col ${bgc}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 mb-0.5 ${tc}`}>
                  <LineChartIcon size={16} className="text-emerald-500" /> Progressão de Carga
                </h2>
                <p className={`text-[11px] ${mutec}`}>Evolução do peso médio ao longo do mês.</p>
              </div>
              
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger className={`w-full sm:w-[180px] h-8 text-xs font-medium ${isLightMode ? 'bg-white border-slate-300 text-slate-800' : ''}`}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {progressionData?.map(p => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                  {progressionData?.length === 0 && (
                    <SelectItem value="none" disabled>Sem dados</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full min-h-[200px]">
              {currentProgression ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentProgression.history} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? "#e2e8f0" : "#334155"} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(val) => {
                        const [, m, d] = val.split('-');
                        return `${d}/${m}`;
                      }}
                      axisLine={false} 
                      tickLine={false} 
                      dy={5}
                    />
                    <YAxis 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                      axisLine={false} 
                      tickLine={false}
                      domain={['auto', 'auto']}
                      dx={-5}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isLightMode ? '#fff' : 'hsl(var(--card))', border: isLightMode ? '1px solid #cbd5e1' : '1px solid hsl(var(--border))', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }}
                      labelFormatter={(label) => `Data: ${formatDateBR(label)}`}
                      formatter={(value: any) => [`${value} kg`, 'Peso Médio']}
                    />
                    {/* Fixed explicit colors for Light/Dark instead of using nonexistent hsl variables */}
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: isLightMode ? "#fff" : "hsl(var(--card))" }} 
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${mutec}`}>
                  <AlertTriangle size={20} className="opacity-50" />
                  <p className="text-xs font-medium">Dados insuficientes.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Mental Checkin and Weight History */}
        <div className={`grid grid-cols-1 ${isStackedLayout ? '' : 'lg:grid-cols-2'} gap-4 w-full`}>
          {/* Mental Checkin Chart */}
          <div className={`rounded-xl border p-4 shadow-sm flex flex-col ${bgc}`}>
            <div>
              <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 mb-0.5 ${tc}`}>
                <Brain size={16} className="text-blue-500" /> Saúde Mental
              </h2>
              <p className={`text-[11px] mb-2 ${mutec}`}>Acompanhamento diário de Sono, Humor e Estresse.</p>
            </div>
            
            <div className="w-full min-h-[180px]">
              {mentalChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mentalChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10 }}
                      tickFormatter={(val) => {
                        const [, m, d] = val.split('-');
                        return `${d}/${m}`;
                      }}
                      axisLine={false} tickLine={false} 
                    />
                    <YAxis 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10 }} 
                      axisLine={false} tickLine={false}
                      domain={[0, 10]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isLightMode ? '#fff' : 'hsl(var(--card))', border: isLightMode ? '1px solid #cbd5e1' : '1px solid hsl(var(--border))', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }}
                    />
                    <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: '10px' }}/>
                    <Area type="monotone" dataKey="sleep" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSleep)" name="Sono (h)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mood" stroke="#10b981" fillOpacity={1} fill="url(#colorMood)" name="Humor (1-10)" strokeWidth={2} />
                    <Area type="monotone" dataKey="stress" stroke="#ef4444" fillOpacity={1} fill="url(#colorStress)" name="Estresse (1-10)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${mutec}`}>
                  <Brain size={20} className="opacity-50" />
                  <p className="text-xs font-medium">Nenhum Check-in.</p>
                </div>
              )}
            </div>
          </div>

          {/* Weight History Chart */}
          <div className={`rounded-xl border p-4 shadow-sm flex flex-col ${bgc}`}>
            <div>
              <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 mb-0.5 ${tc}`}>
                <Activity size={16} className="text-purple-500" /> Evolução de Peso
              </h2>
              <p className={`text-[11px] mb-2 ${mutec}`}>Histórico de pesagem nas avaliações do aluno.</p>
            </div>
            
            <div className="w-full min-h-[180px]">
              {weightHistory && weightHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? "#e2e8f0" : "#334155"} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(val) => {
                        const [, m, d] = val.split('-');
                        return `${d}/${m}`;
                      }}
                      axisLine={false} 
                      tickLine={false} 
                      dy={5}
                    />
                    <YAxis 
                      tick={{ fill: isLightMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                      axisLine={false} 
                      tickLine={false}
                      domain={['auto', 'auto']}
                      dx={-5}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isLightMode ? '#fff' : 'hsl(var(--card))', border: isLightMode ? '1px solid #cbd5e1' : '1px solid hsl(var(--border))', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }}
                      labelFormatter={(label) => `Data: ${formatDateBR(label)}`}
                      formatter={(value: any) => [`${value} kg`, 'Peso']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="peso" 
                      stroke="#a855f7" 
                      strokeWidth={3} 
                      dot={{ fill: "#a855f7", r: 4, strokeWidth: 2, stroke: isLightMode ? "#fff" : "hsl(var(--card))" }} 
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${mutec}`}>
                  <Activity size={20} className="opacity-50" />
                  <p className="text-xs font-medium">Nenhum peso registrado.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Insights Section and Calendar */}
        <div className={`grid grid-cols-1 ${isStackedLayout ? '' : 'lg:grid-cols-4'} gap-4 w-full`}>
          <div className={`${isStackedLayout ? '' : 'lg:col-span-3'} space-y-2`}>
            <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 ${tc}`}>
              <Brain size={16} className="text-amber-500" /> Insights Automáticos do Mês
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights?.map((insight, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className={`p-3 rounded-xl border flex items-start gap-2 shadow-sm ${insightColors[insight.type]} ${isLightMode ? 'bg-white' : ''}`}
                >
                  <div className="shrink-0 mt-0.5">{insightIcons[insight.type]}</div>
                  <p className="text-xs font-medium leading-snug">{insight.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className={`font-cinzel text-base font-bold flex items-center gap-2 ${tc}`}>
              <CalendarIcon size={16} className="text-emerald-500" /> Frequência
            </h2>
            <div className={`rounded-xl border p-2 flex justify-center shadow-sm ${bgc}`}>
              <Calendar
                mode="single"
                locale={ptBR}
                selected={undefined}
                month={currentMonth}
                onMonthChange={(month) => setCurrentMonth(month)}
                modifiers={{ hasWorkout: workoutDays || [] }}
                onDayClick={handleDayClick}
                className="scale-90 sm:scale-100 origin-top"
                components={{
                  DayContent: (props: any) => {
                    const isWorkout = props.activeModifiers?.hasWorkout;
                    if (isWorkout) {
                      return (
                        <div className="relative w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shadow-md shadow-orange-500/30 text-[10px]">
                          {props.date.getDate()}
                        </div>
                      );
                    }
                    return <span className="flex items-center justify-center w-full h-full font-medium text-[11px]">{props.date.getDate()}</span>;
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Workout Details Modal */}
        <Dialog open={!!selectedWorkout} onOpenChange={(open) => !open && setSelectedWorkout(null)}>
          <DialogContent className={`max-w-md backdrop-blur-xl ${bgc}`}>
            <DialogHeader>
              <DialogTitle className={`font-cinzel text-lg ${tc}`}>Treino do Dia</DialogTitle>
              <DialogDescription className={mutec}>
                {selectedWorkout && new Date(selectedWorkout.started_at).toLocaleDateString("pt-BR")} - {selectedWorkout?.group_name || "Treino"}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 mt-4">
              {selectedWorkout?.exercises?.map((ex: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-secondary/30 border-[hsl(var(--glass-border))]'}`}>
                  <p className={`font-medium text-sm mb-2 ${tc}`}>{ex.name}</p>
                  <div className="space-y-1.5">
                    {ex.setsData?.map((set: any, sIdx: number) => (
                      <div key={sIdx} className="flex items-center justify-between text-xs">
                        <span className={mutec}>Série {set.setNumber}</span>
                        <div className="flex gap-4">
                          <span className={set.done ? "text-emerald-500 font-medium" : mutec}>
                            {set.reps} reps
                          </span>
                          <span className={set.done ? "text-amber-500 font-medium" : mutec}>
                            {set.weight} kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(!selectedWorkout?.exercises || selectedWorkout.exercises.length === 0) && (
                <p className={`text-sm text-center ${mutec}`}>Nenhum exercício registrado.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EspecialistaRelatorio;
