import { PieChart, Pie, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import type { LegendPayload } from "recharts";

const FALLBACK = [
  "var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)",
  "var(--chart-6)","var(--chart-7)","var(--chart-8)","var(--chart-9)","var(--chart-10)",
];

type PieItem = { name: string; value: number; color?: string; icon?: string };

function withBase(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

// Legend con scroll cuando hay muchos items
function CustomLegend({
  payload,
  data,
}: {
  payload?: readonly LegendPayload[];
  data: PieItem[];
}) {
  if (!payload?.length) return null;

  return (
    <div
      style={{
        marginTop: 8,
        maxHeight: 110,
        overflow: "auto",
        paddingRight: 6,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {payload.map((p, i) => {
          const item = data.find((d) => d.name === p.value);
          const icon = item?.icon ? withBase(item.icon) : null;

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: p.color,
                  flex: "0 0 auto",
                }}
              />
              {icon && (
                <img
                  src={icon}
                  alt=""
                  style={{ width: 18, height: 18, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }}
                />
              )}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={p.value}
              >
                {p.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderCalloutLabel(props: any, data: PieItem[], topLabelCount: number) {
  const { cx, cy, midAngle, outerRadius, index, name, value } = props;

  // ✅ Estrategia pro: labels solo para Top N (la data viene ordenada en Archive, pero igual lo aplicamos acá)
  if (index >= topLabelCount) return null;

  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22; // un poco más lejos
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);

  const anchor = x > cx ? "start" : "end";
  const item = data[index];
  const icon = item?.icon ? withBase(item.icon) : null;

  // ✅ icono más grande
  const iconSize = 60;          // antes 18
  const gap = 6;                // separación entre icono y texto (vertical)

  // posiciona el icono arriba del texto, centrado con el anchor
  const iconX = anchor === "start" ? x : x - iconSize;
  const iconY = y - iconSize - gap;

  // texto legible siempre
  const labelText = `${name} ${value}%`;

  return (
    <g>
      {icon && (
        <image
          href={icon}
          x={iconX}
          y={iconY}
          width={iconSize}
          height={iconSize}
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      <text
        x={x}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        style={{
          fontSize: 12,
          fill: "rgba(27,29,42,0.92)",
          paintOrder: "stroke",
          stroke: "rgba(255,255,255,0.95)",
          strokeWidth: 3,
        }}
      >
        {labelText}
      </text>
    </g>
  );
}

export default function MetaPie({ data }: { data: PieItem[] }) {
  // ✅ Top N labels (ajústalo a gusto)
  const TOP_LABELS = 8;

  // ✅ Altura: suficiente para labels + leyenda
  const height = data.length > TOP_LABELS ? 520 : 460;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={135}
            innerRadius={62}
            paddingAngle={2}
            labelLine={true}
            label={(p) => renderCalloutLabel(p, data, TOP_LABELS)}
          >
            {data.map((d, i) => (
              <Cell key={`cell-${i}`} fill={d.color ?? FALLBACK[i % FALLBACK.length]} />
            ))}
          </Pie>

          <Tooltip
            formatter={(v: any) => [`${v}%`, "Meta"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(10px)",
              boxShadow: "var(--shadow-soft)",
            }}
          />

          <Legend verticalAlign="bottom" content={(props) => <CustomLegend payload={props.payload} data={data} />} />

        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
