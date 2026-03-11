export default function ScoreResultCard({ result }) {
    if (!result) return null;

    const metrics = [
        { label: 'Percentage', value: `${result.percentage_score}%`, color: '#22d3ee', desc: 'Raw score as percentage' },
        { label: 'Z-Score', value: result.z_score.toFixed(4), color: '#818cf8', desc: 'Standard deviations from mean' },
        { label: 'Normalized', value: result.normalized_score.toFixed(1), color: '#34d399', desc: 'Universal scale (μ=50, σ=10)' },
        { label: 'Percentile', value: `${result.percentile}%`, color: '#fbbf24', desc: 'Rank among peers' },
    ];

    const getPercentileLabel = (p) => {
        if (p >= 90) return { text: 'Excellent', color: '#34d399' };
        if (p >= 75) return { text: 'Above Average', color: '#22d3ee' };
        if (p >= 50) return { text: 'Average', color: '#fbbf24' };
        if (p >= 25) return { text: 'Below Average', color: '#fb923c' };
        return { text: 'Needs Improvement', color: '#fb7185' };
    };

    const pl = getPercentileLabel(result.percentile);

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Performance badge */}
            <div className="flex items-center gap-3">
                <span className="badge" style={{ background: `${pl.color}20`, color: pl.color, fontSize: '0.75rem', padding: '4px 14px' }}>
                    {pl.text}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#5a6a96' }}>
                    Year Bucket: <strong style={{ color: '#8b9cc7' }}>{result.year_bucket}</strong>
                </span>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metrics.map((m, i) => (
                    <div
                        key={m.label}
                        className="card animate-fade-in"
                        style={{ padding: '16px 18px', animationDelay: `${i * 60}ms` }}
                    >
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a6a96', marginBottom: 4 }}>
                            {m.label}
                        </p>
                        <p className="num-highlight" style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color, lineHeight: 1.2 }}>
                            {m.value}
                        </p>
                        <p style={{ fontSize: '0.625rem', color: '#3d4f7a', marginTop: 4 }}>{m.desc}</p>
                    </div>
                ))}
            </div>

            {/* Stats context */}
            <div className="card" style={{ padding: '14px 18px' }}>
                <div className="flex flex-wrap gap-x-8 gap-y-2" style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: '#5a6a96' }}>Board Mean: <strong className="num-highlight" style={{ color: '#8b9cc7' }}>{result.mean_used}</strong></span>
                    <span style={{ color: '#5a6a96' }}>Std Dev: <strong className="num-highlight" style={{ color: '#8b9cc7' }}>{result.std_dev_used}</strong></span>
                    <span style={{ color: '#5a6a96' }}>Samples: <strong className="num-highlight" style={{ color: '#8b9cc7' }}>{result.sample_size.toLocaleString()}</strong></span>
                </div>
            </div>
        </div>
    );
}
