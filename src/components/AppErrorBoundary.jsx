import React from "react";
import styles from "./AppErrorBoundary.module.css";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Föli app render failure", error, info);
  }

  reload = () => {
    globalThis.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className={styles.shell}>
        <section className={styles.card} role="alert" aria-live="assertive">
          <p className={styles.kicker}>Föli departures</p>
          <h1>Something went wrong.</h1>
          <p>
            The app hit an unexpected display error. Your saved public stop
            preferences remain in this browser.
          </p>
          <button type="button" onClick={this.reload}>
            Reload app
          </button>
          <p className={styles.fallback}>
            If reloading does not help, use the official Föli service while
            this independent companion is unavailable.
          </p>
        </section>
      </main>
    );
  }
}
