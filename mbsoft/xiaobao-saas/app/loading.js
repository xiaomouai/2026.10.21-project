const bars = [
  { width: '60%', height: 56 },
  { width: '45%', height: 20 },
  { width: '30%', height: 20 },
]

export default function Loading() {
  return (
    <main>
      <section className="section">
        <div className="stack">
          <div className="skeleton" style={{ width: 120, height: 14 }} />
          {bars.map((bar, index) => (
            <div
              key={index}
              className="skeleton"
              style={{ width: bar.width, height: bar.height }}
            />
          ))}
        </div>
      </section>
      <section className="section">
        <div className="featuredGrid">
          {[0, 1, 2].map((card) => (
            <div className="featuredCard" key={card}>
              <div className="skeleton" style={{ height: 18, width: '40%' }} />
              <div className="skeleton" style={{ height: 14, width: '90%' }} />
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
