import './About.css'

function About() {
  return (
    <section className="visage-about-page">
      <article className="visage-about-panel">
        <h1>About GazeCal</h1>
        <p>
          GazeCal turns your webcam into a real-time gaze tracker. Look at a series
          of dots to calibrate it, then a live dot follows where you're looking —
          all running in your browser, nothing sent anywhere.
        </p>
        <p>
          It's built on WebGazer.js, an open-source eye-tracking library from Brown
          University, adapted here with a custom calibration flow and capture logic.
        </p>
        <p>
          This is an estimate, not a precise measurement — accuracy depends on
          lighting, camera quality, and how carefully you calibrate.
        </p>
      </article>
    </section>
  )
}

export default About
