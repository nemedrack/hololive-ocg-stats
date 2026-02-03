import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

export default function DeckWinrateBar({
  data,
}: {
  data: { name: string; winratePct: number; matches: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="rgba(67,58,115,0.12)" vertical={false} />
          <XAxis
            dataKey="name"
            interval={0}
            angle={-18}
            textAnchor="end"
            height={70}
            tick={{ fontSize: 12, fill: "rgba(27,29,42,0.75)" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "rgba(27,29,42,0.75)" }}
          />
          <Tooltip
            formatter={(v: any, _n: any, p: any) => [`${v}%`, `WR (N=${p.payload.matches})`]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(10px)",
              boxShadow: "var(--shadow-soft)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          <Bar
            dataKey="winratePct"
            name="Winrate %"
            fill="var(--brand-600)"
            radius={[10, 10, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
