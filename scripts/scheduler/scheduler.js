import { LitElement, html } from '../vendor/lit/dist/index.js';
import loadStyle from '../utils/styles.js';
import { getScheduleSim, setScheduleSim, consumeUrlSim } from '../utils/schedule-sim.js';
import { formatDate } from './utils.js';

const styles = await loadStyle(import.meta.url);

const EL_NAME = 'aem-scheduler';

class AemScheduler extends LitElement {
  static properties = {
    current: { attribute: false },
    _format: { state: true },
    _isChanging: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
    this._format = 'local';
  }

  handleSet(timestamp) {
    setScheduleSim(timestamp || null);
  }

  handleTabClick(e) {
    this._format = e.target.textContent.toLowerCase();
  }

  handleChange(e) {
    if (e.target.textContent === 'Change') {
      this._isChanging = !this._isChanging;
      return;
    }
    this.handleSet(this.timestamp);
  }

  get timestamp() {
    const curr = new Date().toISOString();
    const date = this.shadowRoot.querySelector('[type="datetime-local"]').value || curr[0];
    const dateTime = new Date(date);
    return Math.floor(dateTime.getTime() / 1000);
  }

  renderInput() {
    return html`
      <p class="date-label">Local</p>
      <input type="datetime-local" />
    `;
  }

  renderDate() {
    const { date, time } = formatDate(Number(this.current * 1000));
    const { date: utcDate, time: utcTime } = formatDate(Number(this.current * 1000), 'UTC');

    return html`
      <div class="date-group">
        <div class="date-tabs">
          <button @click=${this.handleTabClick} class="date-tab ${this._format === 'local' ? 'is-selected' : ''}">Local</button>
          <button @click=${this.handleTabClick} class="date-tab ${this._format === 'utc' ? 'is-selected' : ''}">UTC</button>
        </div>
        <div class="date-values">
          <p class="date-value ${this._format === 'local' ? 'is-selected' : ''}">${date} ${time}</p>
          <p class="date-value ${this._format === 'utc' ? 'is-selected' : ''}">${utcDate} ${utcTime}</p>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="main-content">
        <p class="heading">Date Simulator</p>
        <div class="details">
          ${this._isChanging ? this.renderInput() : this.renderDate()}
        </div>
      </div>
      <div class="actions">
        <button @click=${() => this.handleSet()}>Close</button>
        <button @click=${this.handleChange}>${this._isChanging ? 'Accept' : 'Change'}</button>
      </div>
    `;
  }
}

customElements.define(EL_NAME, AemScheduler);

const toggleScheduler = () => {
  setScheduleSim(getScheduleSim() ? null : Math.floor(Date.now() / 1000));
};

export default toggleScheduler;

// Auto-mount the scheduler UI when a sim is active. Runs once per page load.
(() => {
  const sim = consumeUrlSim();
  if (!sim) return;
  const scheduler = document.querySelector('aem-scheduler')
    ?? document.body.appendChild(document.createElement(EL_NAME));
  scheduler.current = sim;
})();
