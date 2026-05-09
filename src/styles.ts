const STYLE_ID = "unagi-box-styles";

export function injectPanelStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
#unagi-box-panel {
  position: fixed;
  left: calc(100vw - 436px);
  top: 16px;
  z-index: 9999;
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, #f8f2e7 0%, #f1e7d6 100%);
  color: #2a2118;
  border: 1px solid #d9ccb6;
  box-shadow: 0 24px 60px rgba(65, 46, 24, 0.22);
  font-family: "Avenir Next", "Segoe UI", ui-sans-serif, sans-serif;
  display: none;
}
.ct-flash {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle, rgba(255,245,200,0.92) 0%, rgba(255,210,90,0.56) 35%, rgba(255,255,255,0) 75%);
}
.ct-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  cursor: move;
}
.ct-title {
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.02em;
}
.ct-close {
  border: none;
  border-radius: 999px;
  background: #e7ddcc;
  color: #58493a;
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 700;
}
.ct-focus {
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fffaf2 0%, #f6ecd9 100%);
  border: 1px solid #e0d4bd;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
}
.ct-timer {
  margin-bottom: 12px;
  padding: 42px 18px;
  min-height: 180px;
  border-radius: 20px;
  color: #fffaf2;
  text-align: center;
  font-weight: 800;
  font-size: 104px;
  line-height: 0.95;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ct-timer-work {
  background: linear-gradient(135deg, #163d38 0%, #24554f 100%);
  box-shadow: 0 14px 28px rgba(22,61,56,0.26);
}
.ct-timer-break {
  background: linear-gradient(135deg, #7a4d11 0%, #b87518 100%);
  box-shadow: 0 14px 28px rgba(122,77,17,0.26);
}
.ct-status {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #efe4d2;
  color: #6a563f;
  font-size: 13px;
  font-weight: 700;
}
.ct-energy,
.ct-primary-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.ct-primary-actions {
  gap: 10px;
}
.ct-details {
  margin-bottom: 6px;
  border-radius: 14px;
  background: #f3eadb;
  border: 1px solid #e0d3bf;
  padding: 0 8px 8px 8px;
}
.ct-summary {
  cursor: pointer;
  font-weight: 650;
  padding: 7px 0;
  user-select: none;
  color: #554635;
}
.ct-surface {
  margin-bottom: 4px;
  padding: 8px;
  border-radius: 14px;
  background: #fbf7ef;
  border: 1px solid #e4d7c3;
}
.ct-chooser {
  margin-bottom: 10px;
}
.ct-field {
  display: block;
  font-size: 12px;
  color: #7a644c;
  font-weight: 600;
}
.ct-field-label {
  margin-bottom: 2px;
}
.ct-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d6c8b1;
  background: #fffdf8;
  color: #2a2118;
  box-sizing: border-box;
}
.ct-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ct-title-row {
  margin-bottom: 6px;
}
.ct-due-field {
  display: flex;
  gap: 8px;
  align-items: end;
  position: relative;
}
.ct-hidden-date {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}
.ct-date-button {
  width: 44px;
  min-width: 44px;
  padding: 10px 0;
  border-radius: 10px;
  border: 1px solid #d6c8b1;
  background: #efe4d2;
  color: #5f503f;
  cursor: pointer;
  font-weight: 600;
}
.ct-button {
  display: block;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 12px;
  background: var(--ct-button-bg);
  color: var(--ct-button-color);
  cursor: pointer;
  font-weight: var(--ct-button-weight);
  box-shadow: 0 10px 18px rgba(42,33,24,0.14);
}
.ct-energy-button {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  background: #f3e8d7;
  color: #6d5b46;
  box-shadow: inset 0 0 0 1px #dfd1ba;
}
.ct-energy-button-active {
  background: #24554f;
  color: #fffaf2;
  box-shadow: 0 10px 18px rgba(36,85,79,0.2);
}
.ct-focus-kicker {
  font-size: 12px;
  font-weight: 800;
  color: #8c7457;
  letter-spacing: 0.08em;
}
.ct-focus-title {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 800;
}
.ct-focus-copy {
  margin-top: 6px;
  color: #78624b;
}
.ct-focus-action {
  margin-top: 12px;
}
.ct-focus-state {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  color: #0f6d57;
}
.ct-focus-next {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 800;
  color: #8c7457;
}
.ct-focus-task {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
}
.ct-focus-next-task {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 800;
}
.ct-focus-meta {
  margin-top: 4px;
  color: #6b5946;
}
.ct-message {
  font-size: 12px;
}
.ct-list {
  display: grid;
  gap: 8px;
}
.ct-task-row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #dcccb5;
  border-radius: 10px;
  background: #fffdf8;
  color: #2a2118;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(60,43,20,0.08);
}
.ct-more-button {
  margin-top: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: #e8dece;
  color: #5f503f;
  cursor: pointer;
  font-weight: 700;
}
`;
	document.head.append(style);
}
