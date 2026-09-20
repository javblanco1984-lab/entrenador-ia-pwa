const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");

const connectButton = document.querySelector("#connect-button");
const statusElement = document.querySelector("#status");
const dataElement = document.querySelector("#data");
const sourceElement = document.querySelector("#source");
const firstSheetElement = document.querySelector("#first-sheet");
const checkedAtElement = document.querySelector("#checked-at");

let tokenClient;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function configurationIsReady() {
  const config = window.APP_CONFIG;
  return (
    config &&
    !config.googleClientId.startsWith("PENDIENTE_") &&
    !config.appsScriptDeploymentId.startsWith("PENDIENTE_")
  );
}

function initialiseGoogle() {
  if (!configurationIsReady()) {
    setStatus("Página publicada. Falta completar la configuración segura de Google.");
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    setStatus("No se pudo cargar el acceso de Google. Comprueba la conexión.", true);
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: window.APP_CONFIG.googleClientId,
    scope: SCOPES,
    callback: handleTokenResponse,
    error_callback: () => {
      setStatus("La conexión con Google se canceló o no pudo completarse.", true);
      connectButton.disabled = false;
    },
  });

  connectButton.disabled = false;
  setStatus("Listo para conectar. No se ha leído ningún dato todavía.");
}

async function handleTokenResponse(response) {
  if (response.error || !response.access_token) {
    setStatus("Google no concedió el acceso de solo lectura.", true);
    connectButton.disabled = false;
    return;
  }

  setStatus("Cuenta autorizada. Leyendo la fuente oficial…");

  try {
    const result = await runAppsScript(response.access_token);
    sourceElement.textContent = result.source;
    firstSheetElement.textContent = result.firstSheet;
    checkedAtElement.textContent = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(result.checkedAt));
    dataElement.hidden = false;
    setStatus("Conexión verificada. Lectura realizada correctamente.");
  } catch (error) {
    setStatus(error.message || "No se pudo leer la hoja maestra.", true);
  } finally {
    connectButton.disabled = false;
  }
}

async function runAppsScript(accessToken) {
  const deploymentId = window.APP_CONFIG.appsScriptDeploymentId;
  const response = await fetch(
    `https://script.googleapis.com/v1/scripts/${deploymentId}:run`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        function: "obtenerDatoPrueba",
        parameters: [],
        devMode: false,
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Error de Google (${response.status}).`);
  }
  if (payload.error) {
    throw new Error(payload.error.message || "Apps Script devolvió un error.");
  }

  return payload.response.result;
}

connectButton.addEventListener("click", () => {
  if (!tokenClient) {
    setStatus("La conexión con Google aún no está preparada.", true);
    return;
  }
  connectButton.disabled = true;
  setStatus("Abriendo el acceso seguro de Google…");
  tokenClient.requestAccessToken({ prompt: "select_account" });
});

window.addEventListener("load", initialiseGoogle);
