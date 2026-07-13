const slider = document.getElementById("volSlider");
const readout = document.getElementById("readout");
const meterFill = document.getElementById("meterFill");
const statusDot = document.getElementById("statusDot");
const tabInfo = document.getElementById("tabInfo");
const presets = document.querySelectorAll(".preset-btn");

let currentTabId = null;

function updateUI(val) {
  const pct = Math.round(val * 100);
  readout.textContent = pct;
  readout.classList.toggle("danger", val > 1.5);
  meterFill.style.width = (val / 6 * 100) + "%";
  meterFill.classList.toggle("danger", val > 1.5);
  presets.forEach(btn => {
    btn.classList.toggle("active", Math.abs(parseFloat(btn.dataset.val) - val) < 0.01);
  });
}

function applyVolume(val) {
  val = parseFloat(val);
  slider.value = val;
  updateUI(val);
  if (currentTabId == null) return;

  browser.tabs.executeScript(currentTabId, {
    code: `window.dispatchEvent(new CustomEvent('__vbSet', { detail: ${val} }));`
  })
  .then(() => {
    statusDot.classList.add("active");
    browser.storage.local.set({ ["vol_" + currentTabId]: val });
  })
  .catch(err => {
    console.warn("Failed:", err.message);
    statusDot.classList.remove("active");
  });
}

slider.addEventListener("input", function () { applyVolume(this.value); });
presets.forEach(btn => btn.addEventListener("click", function () { applyVolume(this.dataset.val); }));
document.getElementById("resetBtn").addEventListener("click", function () { applyVolume(1); });

browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (!tabs[0]) return;
  currentTabId = tabs[0].id;
  try { tabInfo.textContent = new URL(tabs[0].url).hostname; }
  catch (e) { tabInfo.textContent = "—"; }

  browser.storage.local.get("vol_" + currentTabId).then(result => {
    const saved = result["vol_" + currentTabId];
    const v = saved != null ? saved : 1;
    slider.value = v;
    updateUI(v);
  });
});
