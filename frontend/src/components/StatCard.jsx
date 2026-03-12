export default function StatCard({ icon, label, value, delta, color = 'indigo', delay = 0 }) {
    const palette = {
        indigo: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.15)', text: '#818cf8', glow: 'rgba(99,102,241,0.06)' },
        cyan: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.15)', text: '#22d3ee', glow: 'rgba(6,182,212,0.06)' },
        emerald: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.15)', text: '#34d399', glow: 'rgba(16,185,129,0.06)' },
        amber: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)', text: '#fbbf24', glow: 'rgba(245,158,11,0.06)' },
        rose: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.15)', text: '#fb7185', glow: 'rgba(244,63,94,0.06)' },
        violet: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.15)', text: '#a78bfa', glow: 'rgba(139,92,246,0.06)' },
    };
    const p = palette[color] || palette.indigo;

    return (
        <div
            className="animate-fade-in"
            style={{
                animationDelay: `${delay}ms`,
                background: `linear-gradient(135deg, ${p.bg}, transparent)`,
                border: `1px solid ${p.border}`,
                borderRadius: 14,
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
            }}
        >
            {/* Glow orb */}
            <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: p.glow, filter: 'blur(25px)',
            }} />

            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a6a96', marginBottom: 6 }}>
                        {label}
                    </p>
                    <p className="num-highlight" style={{ fontSize: '1.75rem', fontWeight: 800, color: p.text, lineHeight: 1.1 }}>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {delta && (
                        <p style={{ fontSize: '0.6875rem', marginTop: 4, color: delta >= 0 ? '#34d399' : '#fb7185' }}>
                            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% from last period
                        </p>
                    )}
                </div>
                <div style={{ fontSize: '1.75rem', opacity: 0.6 }}>{icon}</div>
            </div>
        </div>
    );
}
