import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ClipboardCheck, ClipboardList, School, Users } from "lucide-react";
import { useState } from "react";
import { getDashboardStats, getMyPermissions } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { compareSchoolNames } from "@/lib/school-order";
import { getLegacyYearStats } from "@/lib/ext/legado.functions";
import { Button, Card, Spinner } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — Grupo Inter" },
      { name: "description", content: "Resumo dos cadastros escolares do Grupo Inter." },
      { property: "og:title", content: "Início — Grupo Inter" },
      { property: "og:description", content: "Resumo dos cadastros escolares do Grupo Inter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function YearCard({
  label,
  visits,
  children,
}: {
  label: string;
  visits: number | null;
  children: number | null;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-primary">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de visitas</p>
            <p className="font-display text-xl font-semibold text-foreground">
              {visits === null ? "—" : visits}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de crianças</p>
            <p className="font-display text-xl font-semibold text-foreground">
              {children === null ? "—" : children}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

type IndicatorDatum = { label: string; count: number };

function SeriesTick({
  x = 0,
  y = 0,
  payload,
  index,
  maxChars = 28,
  showRate = false,
  rates = [],
}: {
  x?: number;
  y?: number;
  payload?: { value?: string; index?: number };
  index?: number;
  maxChars?: number;
  showRate?: boolean;
  rates?: number[];
}) {
  const label = payload?.value ?? "";
  const position = index ?? payload?.index ?? -1;
  const rate = rates[position];
  const hasRate = showRate && typeof rate === "number";
  const words = label.split(/\s+/);
  const lines = words.reduce<string[]>((result, word) => {
    const last = result[result.length - 1];
    if (!last || `${last} ${word}`.length > maxChars) result.push(word);
    else result[result.length - 1] = `${last} ${word}`;
    return result;
  }, []);
  const totalLines = lines.length + (hasRate ? 1 : 0);
  const rateText = hasRate ? `${Math.round(rate as number)}%` : "";
  const badgeW = rateText.length * 6.4 + 14;
  const badgeH = 16;
  const badgeX = x - 8 - badgeW;
  const labelStep = 13.2;
  const firstOffset = -(totalLines - 1) * 6.6;
  const lastBaseline = y + firstOffset + (lines.length - 1) * labelStep;
  const badgeY = lastBaseline + 1;

  return (
    <g>
      <text x={x - 8} y={y} textAnchor="end" fill="var(--muted-foreground)" fontSize={12}>
        {lines.map((line, index) => (
          <tspan
            key={`${line}-${index}`}
            x={x - 8}
            dy={index === 0 ? `${firstOffset}px` : `${labelStep}px`}
          >
            {line}
          </tspan>
        ))}
      </text>
      {hasRate && (
        <g>
          <rect
            x={badgeX}
            y={badgeY}
            width={badgeW}
            height={badgeH}
            rx={badgeH / 2}
            ry={badgeH / 2}
            style={{ fill: "var(--destructive)" }}
          />
          <text
            x={badgeX + badgeW / 2}
            y={badgeY + badgeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--pill-foreground)" }}
            fontSize={10.5}
            fontWeight={700}
          >
            {rateText}
          </text>
        </g>
      )}
    </g>
  );
}

function SeriesChart({
  data,
  title = "Série de interesse",
  chartHeight: chartHeightProp,
}: {
  data: IndicatorDatum[];
  title?: string;
  chartHeight?: number;
}) {
  const labelWidth = Math.min(
    170,
    Math.max(92, Math.max(...data.map((item) => Math.min(item.label.length, 24)), 0) * 6.5),
  );
  const chartHeight = chartHeightProp ?? Math.max(208, data.length * 38);

  return (
    <Card className="flex h-full min-w-0 flex-col p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhuma resposta no período.
        </div>
      ) : (
        <ChartContainer
          config={{ count: { label: "Quantidade", color: "var(--primary)" } }}
          className="mt-3 w-full aspect-auto"
          style={{ height: chartHeight }}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={labelWidth}
              interval={0}
              tick={<SeriesTick />}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
}

type NeighborhoodGroup = {
  school: string;
  items: { label: string; city: string; count: number; started?: number; won?: number }[];
};

function NeighborhoodChart({
  data,
  title = "Visitantes por bairro",
  emptyText = "Nenhum endereço no período.",
  showStarted = false,
  wonLabel = "Ganhos",
}: {
  data: NeighborhoodGroup[];
  title?: string;
  emptyText?: string;
  showStarted?: boolean;
  wonLabel?: string;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
        {showStarted && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Vinculados</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-2)" }} />Atendimento iniciado</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-4)" }} />{wonLabel}</span>
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-destructive px-1.5 py-px text-[10px] font-bold leading-none text-pill-foreground">%</span>
              <span className="text-[11px] italic text-muted-foreground">conversão ({wonLabel.toLowerCase()} ÷ vinculados)</span>
            </span>
          </div>
        )}
      </div>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="mt-3 grid gap-4 grid-cols-1 @min-[36rem]/dashboard:grid-cols-2 @min-[64rem]/dashboard:grid-cols-4">
          {data.map((group) => {
            const longest = Math.max(
              0,
              ...group.items.map(
                (item) => (item.city ? `${item.label} — ${item.city}` : item.label).length,
              ),
            );
            const labelWidth = Math.min(140, Math.max(110, Math.min(longest, 14) * 7.5));
            const rates = group.items.map((item) =>
              item.count > 0 ? ((item.won ?? 0) / item.count) * 100 : 0,
            );
            return (
              <div key={group.school} className="min-w-0">
                <p className="text-xs font-semibold text-primary">{group.school}</p>
                {group.items.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
                ) : (
                  <ChartContainer
                    config={showStarted
                      ? { count: { label: "Vinculados", color: "var(--primary)" }, started: { label: "Atendimento iniciado", color: "var(--chart-2)" }, won: { label: wonLabel, color: "var(--chart-4)" } }
                      : { count: { label: "Visitas", color: "var(--primary)" } }}
                    className="mt-2 w-full aspect-auto"
                    style={{ height: Math.max(140, group.items.length * (showStarted ? 96 : 46)) }}
                  >
                    <BarChart
                      data={group.items.map((item) => ({
                        ...item,
                        label: item.city ? `${item.label} — ${item.city}` : item.label,
                      }))}
                      layout="vertical"
                      margin={{ top: 4, right: 32, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        width={labelWidth}
                        interval={0}
                        tick={<SeriesTick maxChars={14} showRate={showStarted} rates={rates} />}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="count"
                          position="right"
                          offset={6}
                          className="fill-foreground"
                          fontSize={11}
                        />
                      </Bar>
                      {showStarted && (
                        <Bar dataKey="started" fill="var(--color-started)" radius={[0, 4, 4, 0]}>
                          <LabelList valueAccessor={(e: any) => { const r = e?.payload ?? e; const v = Number(r?.started ?? 0); const c = Number(r?.count ?? 0); return c > 0 ? `${v} (${Math.round((v / c) * 100)}%)` : `${v}`; }} position="right" offset={6} className="fill-foreground" fontSize={11} />
                        </Bar>
                      )}
                      {showStarted && (
                        <Bar dataKey="won" fill="var(--color-won)" radius={[0, 4, 4, 0]}>
                          <LabelList valueAccessor={(e: any) => { const r = e?.payload ?? e; const v = Number(r?.won ?? 0); const c = Number(r?.count ?? 0); return c > 0 ? `${v} (${Math.round((v / c) * 100)}%)` : `${v}`; }} position="right" offset={6} className="fill-foreground" fontSize={11} />
                        </Bar>
                      )}
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const SOURCE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function SourcesChart({ data }: { data: IndicatorDatum[] }) {
  return (
    <Card className="flex h-full min-w-0 flex-col p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Como conheceu a escola</h2>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhuma resposta no período.
        </div>
      ) : (
        <div className="mt-3 grid flex-1 content-center items-center gap-3">
          <ChartContainer
            config={{ count: { label: "Quantidade" } }}
            className="mx-auto h-40 w-full aspect-auto"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={34}
                outerRadius={62}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {data.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 text-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

const MONTH_LABELS = [
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
];

type MonthlyDatum = { month: number; visits: number; children: number };
type DailyDatum = { month: number; day: number; visits: number; children: number };

function cumulative(data: MonthlyDatum[] | null | undefined, metric: "visits" | "children") {
  const byMonth = new Map((data ?? []).map((item) => [item.month, item]));
  let total = 0;
  return Array.from({ length: 12 }, (_, month) => {
    total += byMonth.get(month)?.[metric] ?? 0;
    return total;
  });
}

// Calendário real de um mês do ano letivo (0 = agosto ... 11 = julho).
function calendarOfMonth(schoolYear: number, monthIndex: number) {
  const month = (7 + monthIndex) % 12;
  const year = monthIndex <= 4 ? schoolYear - 1 : schoolYear;
  const days = new Date(year, month + 1, 0).getDate();
  return { year, month, days };
}

// Acumulado do ano letivo até o dia `day` do mês `monthIndex`.
// `limit` restringe a série do ano corrente até a data de hoje.
function dailyCumulativeAt(
  monthly: MonthlyDatum[] | null | undefined,
  daily: DailyDatum[] | null | undefined,
  metric: "visits" | "children",
  monthIndex: number,
  day: number,
  limit?: { monthIndex: number; day: number },
): number | null {
  if (
    limit &&
    (monthIndex > limit.monthIndex ||
      (monthIndex === limit.monthIndex && day > limit.day))
  ) {
    return null;
  }
  const byMonth = new Map((monthly ?? []).map((item) => [item.month, item[metric] ?? 0]));
  let total = 0;
  for (let m = 0; m < monthIndex; m++) total += byMonth.get(m) ?? 0;
  const deltas = new Map<number, number>();
  for (const item of daily ?? []) {
    if (item.month === monthIndex) {
      deltas.set(item.day, (deltas.get(item.day) ?? 0) + (item[metric] ?? 0));
    }
  }
  for (let d = 1; d <= day; d++) total += deltas.get(d) ?? 0;
  return total;
}

function CumulativeChart({
  currentYear,
  current,
  currentDaily,
  previous,
  previousDaily,
  previous2,
  previous2Daily,
}: {
  currentYear: number;
  current: MonthlyDatum[];
  currentDaily: DailyDatum[];
  previous: MonthlyDatum[] | null;
  previousDaily: DailyDatum[] | null;
  previous2: MonthlyDatum[] | null;
  previous2Daily: DailyDatum[] | null;
}) {
  const [metric, setMetric] = useState<"visits" | "children">("visits");
  const [granularity, setGranularity] = useState<"month" | "day">("month");
  const now = new Date();
  const currentIndex = (now.getMonth() - 7 + 12) % 12;
  const [dayMonth, setDayMonth] = useState(currentIndex);
  const todayLabel = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;

  const years = [
    {
      year: currentYear - 2,
      values: cumulative(previous2, metric),
      monthly: previous2,
      daily: previous2Daily,
      color: "var(--chart-1)",
    },
    {
      year: currentYear - 1,
      values: cumulative(previous, metric),
      monthly: previous,
      daily: previousDaily,
      color: "var(--chart-2)",
    },
    {
      year: currentYear,
      values: cumulative(current, metric),
      monthly: current,
      daily: currentDaily,
      color: "var(--chart-3)",
    },
  ];
  const available = years.filter((item) => item.year === currentYear || (item.values[11] ?? 0) > 0);

  const maxDays =
    granularity === "day"
      ? available.reduce((max, item) => Math.max(max, calendarOfMonth(item.year, dayMonth).days), 28)
      : 0;

  const chartData =
    granularity === "month"
      ? MONTH_LABELS.map((label, index) => {
          const point: Record<string, string | number | null> = { label };
          for (const item of available) {
            const isCurrent = item.year === currentYear;
            point[`y${item.year}`] = isCurrent && index > currentIndex ? null : (item.values[index] ?? 0);
          }
          return point;
        })
      : Array.from({ length: maxDays }, (_, i) => {
          const day = i + 1;
          const point: Record<string, string | number | null> = { label: String(day) };
          for (const item of available) {
            point[`y${item.year}`] = dailyCumulativeAt(
              item.monthly,
              item.daily,
              metric,
              dayMonth,
              day,
              item.year === currentYear
                ? { monthIndex: currentIndex, day: now.getDate() }
                : undefined,
            );
          }
          return point;
        });

  const config = Object.fromEntries(
    available.map((item) => [`y${item.year}`, { label: String(item.year), color: item.color }]),
  );

  return (
    <Card className="flex h-full min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Evolução acumulada{" "}
          <span className="font-normal text-muted-foreground">(até a mesma data)</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {granularity === "day" && (
            <select
              value={dayMonth}
              onChange={(event) => setDayMonth(Number(event.target.value))}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none"
              aria-label="Mês do modo Dia"
            >
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant={granularity === "month" ? "primary" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setGranularity("month")}
            >
              Mês
            </Button>
            <Button
              variant={granularity === "day" ? "primary" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setGranularity("day")}
            >
              Dia
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={metric === "visits" ? "primary" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setMetric("visits")}
            >
              Visitas
            </Button>
            <Button
              variant={metric === "children" ? "primary" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setMetric("children")}
            >
              Crianças
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {available.map((item) => (
          <span key={item.year} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.year}
            <span className="font-semibold text-foreground">{item.values[currentIndex] ?? 0}</span>
          </span>
        ))}
      </div>

      <ChartContainer config={config} className="mt-2 h-64 w-full flex-1 aspect-auto">
        <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            fontSize={11}
            {...(granularity === "day"
              ? { ticks: [1, 5, 10, 15, 20, 25, 30, 31].filter((t) => t <= maxDays) }
              : {})}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {granularity === "day" ? (
            dayMonth === currentIndex && (
              <ReferenceLine
                x={String(now.getDate())}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: `Hoje ${todayLabel}`,
                  position: "insideTopLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            )
          ) : (
            <ReferenceLine
              x={MONTH_LABELS[currentIndex] ?? "Ago"}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `Hoje ${todayLabel}`,
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
          )}
          {available.map((item) => (
            <Line
              key={item.year}
              type="monotone"
              dataKey={`y${item.year}`}
              stroke={item.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </Card>
  );
}

type SchoolDatum = { name: string; visits: number; children: number };

function SchoolComparisonChart({ data }: { data: SchoolDatum[] }) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
          <School className="h-4 w-4" />
        </div>
        <h2 className="font-display font-semibold text-foreground">
          Total de cadastros por escola
        </h2>
      </div>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhum cadastro no período.
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Total de visitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-2" /> Total de crianças
            </span>
          </div>
          <ChartContainer
            config={{
              visits: { label: "Total de visitas", color: "var(--primary)" },
              children: { label: "Total de crianças", color: "var(--chart-2)" },
            }}
            className="mt-2 h-64 w-full aspect-auto"
          >
            <BarChart data={data} margin={{ top: 22, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="visits"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
              <Bar dataKey="children" fill="var(--color-children)" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="children"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </>
      )}
    </Card>
  );
}

function LossReasonsChart({ data }: { data: IndicatorDatum[] }) {
  return (
    <Card className="flex min-w-0 flex-1 flex-col p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Motivos de perda</h2>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Nenhuma perda no período.
        </div>
      ) : (
        <div className="mt-2 grid flex-1 content-center items-center gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(120px,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,0.8fr)_minmax(120px,1fr)]">
          <ChartContainer
            config={{ count: { label: "Quantidade" } }}
            className="mx-auto h-36 w-full aspect-auto"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={30}
                outerRadius={54}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="grid gap-1.5">
            {data.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-start gap-2 text-xs">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 text-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function DashboardPage() {
  const [selected, setSelected] = useState<string[]>([]);

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", selected],
    queryFn: () => getDashboardStats({ data: { schoolIds: selected } }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function toggleSchool(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const now = new Date();
  const currentYear =
    data?.year ?? (now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear());
  const legacyYears = [currentYear - 1, currentYear - 2];
  const selectedNames = selected
    .map((id) => (schools ?? []).find((s) => (s.id as string) === id)?.name as string | undefined)
    .filter((n): n is string => Boolean(n));

  const { data: legacy } = useQuery({
    queryKey: ["legacy-year-stats", legacyYears, selectedNames],
    queryFn: () => getLegacyYearStats({ data: { years: legacyYears, schoolNames: selectedNames } }),
    staleTime: 300_000,
  });

  function legacyFor(year: number) {
    return (legacy ?? []).find((item) => item.year === year) ?? null;
  }

  const schoolLabel =
    selected.length === 0
      ? "Todas as escolas"
      : selected.length === 1
        ? ((schools ?? []).find((school) => school.id === selected[0])?.name ?? "1 escola")
        : `${selected.length} escolas`;

  return (
    <div className="@container/dashboard w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-lg font-semibold text-primary">VISÃO GERAL</h1>
        {(perms?.isAdmin || perms?.isDirecao) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between sm:w-64">
                <span className="truncate">{schoolLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filtrar escolas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSelected([])}>Todas as escolas</DropdownMenuItem>
              <DropdownMenuSeparator />
              {[...(schools ?? [])]
                .sort((a, b) =>
                  compareSchoolNames(String(a.name ?? ""), String(b.name ?? "")),
                )
                .map((school) => (
                <DropdownMenuCheckboxItem
                  key={school.id as string}
                  checked={selected.includes(school.id as string)}
                  onCheckedChange={() => toggleSchool(school.id as string)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {school.name as string}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isLoading || !data ? (
        <div className="mt-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 @min-[36rem]/dashboard:grid-cols-2 @min-[52rem]/dashboard:grid-cols-3">
            <YearCard
              label={`${currentYear} (${currentYear - 1})`}
              visits={data.visits}
              children={data.children}
            />
            <YearCard
              label={`${currentYear - 1} (${currentYear - 2})`}
              visits={legacyFor(currentYear - 1)?.visits ?? null}
              children={legacyFor(currentYear - 1)?.children ?? null}
            />
            <YearCard
              label={`${currentYear - 2} (${currentYear - 3})`}
              visits={legacyFor(currentYear - 2)?.visits ?? null}
              children={legacyFor(currentYear - 2)?.children ?? null}
            />
          </div>

          <div className="mt-3 grid gap-3 @min-[36rem]/dashboard:grid-cols-2 @min-[52rem]/dashboard:grid-cols-3">
            <div className="@min-[36rem]/dashboard:col-span-2">
              <CumulativeChart
                currentYear={currentYear}
                current={data.monthly}
                currentDaily={data.daily ?? []}
                previous={legacyFor(currentYear - 1)?.monthly ?? null}
                previousDaily={legacyFor(currentYear - 1)?.daily ?? null}
                previous2={legacyFor(currentYear - 2)?.monthly ?? null}
                previous2Daily={legacyFor(currentYear - 2)?.daily ?? null}
              />
            </div>
            <div className="@min-[36rem]/dashboard:col-span-2 @min-[52rem]/dashboard:col-span-1">
              <SchoolComparisonChart data={data.bySchool} />
            </div>
          </div>

          <div className="mt-3 grid gap-3 @min-[36rem]/dashboard:grid-cols-2 @min-[52rem]/dashboard:grid-cols-3">
            <SourcesChart data={data.sources} />
            <SeriesChart data={data.series} />
            <div className="flex flex-col gap-3 @min-[36rem]/dashboard:col-span-2 @min-[52rem]/dashboard:col-span-1">
              <Card className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Matrículas efetivadas
                  </h2>
                </div>
                <div className="mt-4 flex flex-1 items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-3xl font-semibold text-foreground">
                      {data.enrollments.total}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.enrollments.percentage.toLocaleString("pt-BR")}% do total de crianças
                    </p>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.min(data.enrollments.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </Card>
              <LossReasonsChart data={data.lossReasons} />
            </div>
          </div>

          <div className="mt-3">
            <NeighborhoodChart data={data.neighborhoods} />
          </div>

          <div className="mt-3">
            <NeighborhoodChart
              title="Quem mais atendeu (Coordenação)"
              emptyText="Sem dados"
              showStarted
              wonLabel="Matriculados"
              data={(data.attendantsBySchool ?? []).map((g) => ({
                school: g.school,
                items: g.items.map((i) => ({ ...i, city: "" })),
              }))}
            />
          </div>

          <div className="mt-3">
            <NeighborhoodChart
              title="Quem mais atendeu (Central de Informações)"
              emptyText="Sem dados"
              showStarted
              wonLabel="Visitas realizadas"
              data={(data.leadOwnersBySchool ?? []).map((g) => ({
                school: g.school,
                items: g.items.map((i) => ({ ...i, city: "" })),
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
