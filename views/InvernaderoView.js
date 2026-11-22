export class InvernaderoView {
  constructor() {
    this.inicializarNavegacion();
    this.realtimeChart = this.crearGrafico("chart-realtime", false);
    this.historyChart = this.crearGrafico("chart-history", true);
  }

  // Cambio entre pestañas (Datos en Tiempo Real, Conectar Sensores, Calendario, Historial)
  inicializarNavegacion() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.target).classList.add("active");
      });
    });
  }

  crearGrafico(canvasId, animado) {
    return new Chart(document.getElementById(canvasId), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Humedad (%)", data: [], borderColor: "#2d6a4f", tension: 0.3 },
          { label: "Temperatura (°C)", data: [], borderColor: "#e07a00", tension: 0.3 }
        ]
      },
      options: { responsive: true, animation: animado }
    });
  }

  // --- Renderizado en pantalla ---
  renderLecturaTiempoReal(data, evaluacion) {
    const pill = document.getElementById("sensor-pill");
    pill.textContent = data.conectado ? `Conectado: ${data.protocolo}` : "Sensor desconectado";
    pill.className = `pill ${data.conectado ? "online" : "offline"}`;

    document.getElementById("val-humedad").textContent = `${data.humedad.toFixed(1)} %`;
    document.getElementById("val-temperatura").textContent = `${data.temperatura.toFixed(1)} °C`;
    document.getElementById("ultima-actualizacion").textContent =
      `Última lectura: ${new Date(data.timestamp).toLocaleTimeString()}`;

    const badgeHum = document.getElementById("badge-humedad");
    badgeHum.textContent = evaluacion.humedadOptima ? "Nivel Óptimo" : "Fuera de Rango";
    badgeHum.className = `badge ${evaluacion.humedadOptima ? "ok" : "alert"}`;

    const badgeTemp = document.getElementById("badge-temperatura");
    badgeTemp.textContent = evaluacion.temperaturaOptima ? "Rango Óptimo" : "Fuera de Rango";
    badgeTemp.className = `badge ${evaluacion.temperaturaOptima ? "ok" : "alert"}`;

    // Actualiza el gráfico en vivo manteniendo los últimos 15 puntos
    const hora = new Date(data.timestamp).toLocaleTimeString();
    this.realtimeChart.data.labels.push(hora);
    this.realtimeChart.data.datasets[0].data.push(data.humedad);
    this.realtimeChart.data.datasets[1].data.push(data.temperatura);

    if (this.realtimeChart.data.labels.length > 15) {
      this.realtimeChart.data.labels.shift();
      this.realtimeChart.data.datasets[0].data.shift();
      this.realtimeChart.data.datasets[1].data.shift();
    }
    this.realtimeChart.update();
  }

  renderBotonesSensor(conectado) {
    document.getElementById("btn-conectar").disabled = conectado;
    document.getElementById("btn-desconectar").disabled = !conectado;
    if (conectado) {
      document.getElementById("troubleshooting-box").classList.add("hidden");
    }
  }

  mostrarGuiaSolucion(visible) {
    document.getElementById("troubleshooting-box").classList.toggle("hidden", !visible);
  }

  renderFrecuencia(segundos) {
    document.getElementById("frecuencia-select").value = String(segundos);
  }

  renderHistorial(registros, evaluador) {
    const tbody = document.getElementById("tabla-historial");
    tbody.innerHTML = "";

    if (registros.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">Sin registros históricos todavía.</td></tr>`;
      return;
    }

    const labels = [];
    const hums = [];
    const temps = [];

    registros.forEach((r) => {
      const ev = evaluador(r.humedad, r.temperatura);
      const todoOk = ev.humedadOptima && ev.temperaturaOptima;

      labels.push(new Date(r.timestamp).toLocaleTimeString());
      hums.push(r.humedad);
      temps.push(r.temperatura);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td>${r.humedad.toFixed(1)} %</td>
        <td>${r.temperatura.toFixed(1)} °C</td>
        <td><span class="badge ${todoOk ? "ok" : "alert"}">${todoOk ? "Óptimo" : "Alerta"}</span></td>
      `;
      tbody.prepend(tr);
    });

    this.historyChart.data.labels = labels;
    this.historyChart.data.datasets[0].data = hums;
    this.historyChart.data.datasets[1].data = temps;
    this.historyChart.update();
  }

  renderCalendarioRiego(lista, onEliminar) {
    const ul = document.getElementById("lista-riegos");
    ul.innerHTML = "";

    if (lista.length === 0) {
      ul.innerHTML = `<li class="empty">No hay riegos configurados aún.</li>`;
      return;
    }

    lista.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${item.hora}</strong> — ${item.dias.join(", ")}<br/>
          <small>${item.nota}</small>
        </div>
        <button class="btn danger btn-sm">Eliminar</button>
      `;
      li.querySelector("button").addEventListener("click", () => onEliminar(item.id));
      ul.appendChild(li);
    });
  }

  // Notificaciones en pantalla y del navegador (RF2 y RF4)
  mostrarAlerta(mensaje, tipo = "warn") {
    const container = document.getElementById("alert-container");
    const div = document.createElement("div");
    div.className = `alert-toast ${tipo}`;
    div.innerHTML = `<span>${mensaje}</span><button class="btn secondary btn-sm">✕</button>`;
    div.querySelector("button").addEventListener("click", () => div.remove());
    container.prepend(div);

    while (container.children.length > 3) container.lastChild.remove();

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("OrchidMonitor 4.0", { body: mensaje });
    }
  }

  // --- Eventos que se conectan al Controlador ---
  bindConectarSensor(handler) {
    document.getElementById("btn-conectar").addEventListener("click", () => {
      const protocolo = document.getElementById("protocolo").value;
      handler(protocolo);
    });
  }

  bindDesconectarSensor(handler) {
    document.getElementById("btn-desconectar").addEventListener("click", handler);
  }

  bindSimularFallo(handler) {
    document.getElementById("btn-simular-fallo").addEventListener("click", handler);
  }

  bindEscenarios(handler) {
    document.getElementById("btn-escenario-optimo").addEventListener("click", () => handler("optimo"));
    document.getElementById("btn-escenario-seco").addEventListener("click", () => handler("seco"));
    document.getElementById("btn-escenario-calor").addEventListener("click", () => handler("calor"));
  }

  bindGuardarFrecuencia(handler) {
    document.getElementById("btn-guardar-frecuencia").addEventListener("click", () => {
      const segundos = Number(document.getElementById("frecuencia-select").value);
      handler(segundos);
    });
  }

  bindGuardarRiego(handler) {
    document.getElementById("form-riego").addEventListener("submit", (e) => {
      e.preventDefault();
      const dias = Array.from(document.querySelectorAll(".days-selector input:checked")).map((i) => i.value);
      const hora = document.getElementById("hora-riego").value;
      const nota = document.getElementById("nota-riego").value.trim();

      if (handler({ dias, hora, nota })) {
        e.target.reset();
      }
    });
  }

  bindActivarNotificaciones(handler) {
    document.getElementById("btn-permiso-notif").addEventListener("click", handler);
  }
}