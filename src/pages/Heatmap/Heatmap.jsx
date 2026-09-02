import './Heatmap.css'

function Heatmap() {
  return (
    <section className="visage-heatmap-page">
      <div className="visage-heatmap-hero">
        <p className="visage-page-kicker">Planned feature</p>
        <h1>Heatmap Session</h1>
        <span className="visage-status-badge">In Progress — Coming Soon</span>
        <p className="visage-heatmap-intro">
          This feature will visualize where a user looked most during a tracked
          session. A heatmap overlay will use color intensity to show where gaze
          points concentrated across the screen—a common UX research technique
          for understanding attention patterns.
        </p>
      </div>

      <article className="visage-heatmap-panel">
        <div className="visage-panel-heading">
          <span aria-hidden="true">01</span>
          <div>
            <p>Roadmap</p>
            <h2>Planned functionality</h2>
          </div>
        </div>

        <ul className="visage-heatmap-list">
          <li>Record gaze coordinates during a live tracking session</li>
          <li>
            Render a color-intensity heatmap overlay showing where attention
            concentrated
          </li>
          <li>Session summary including duration and total gaze points captured</li>
          <li>
            Compare multiple sessions side by side
            <span className="visage-consideration-label">Under consideration</span>
          </li>
        </ul>
      </article>
    </section>
  )
}

export default Heatmap
