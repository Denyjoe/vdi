import { ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

/**
 * GaugeCard — real radial usage gauge, extracted from AdminHardwarePage
 * (the platform's own proven hardware-monitoring UI) so every other
 * "real usage vs. allocation" surface (e.g. University Hardware &
 * Performance) renders with the exact same look, not a re-implementation.
 */
export default function GaugeCard({ title, value, centerLine1, centerLine2, color }) {
  const data = [{ name: title, value: Math.max(0, Math.min(100, value)) }];
  return (
    <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)] shadow-md flex flex-col items-center">
      <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-4">{title}</h3>
      <div className="relative w-full" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="90%"
            innerRadius="80%" outerRadius="100%"
            barSize={14}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background={{ fill: '#334155' }}
              dataKey="value"
              cornerRadius={8}
              fill={color}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{centerLine1}</p>
          {centerLine2 && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{centerLine2}</p>}
        </div>
      </div>
    </div>
  );
}

/** Same red/amber/green thresholds used everywhere usage is shown as a percent. */
export const percentColor = (pct) => {
  if (pct < 50) return '#10B981';
  if (pct < 75) return '#F59E0B';
  return '#EF4444';
};
