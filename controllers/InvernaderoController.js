export class InvernaderoController {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.sensorInterval = null;
    this.historyInterval = null;
    this.frecuenciaSegundos = 3600; // Por defecto: cada 1 hora
    this.escenarioSimulado = "optimo";
    this.protocoloActual = "Wi-Fi (ESP32 + DHT22)";
    this.ultimaLectura = { humedad: 80.0, temperatura: 21.0 };
    this.calendariosActivos = [];
    this.ultimaNotifMinuto = "";

    this.iniciarSuscripciones();
    this.registrarEventosVista();
    this.iniciarVerificadorRiego();
  }

  // --- Conexión reactiva entre Firebase (Model) y la interfaz (View) ---
  iniciarSuscripciones() {
    // RF4 y RF7 (RF8): Lectura y monitoreo en tiempo real
    this.model.suscribirLecturaActual((data) => {
      this.ultimaLectura = data;
      const evaluacion = this.model.evaluarCondiciones(data.humedad, data.temperatura);
      this.view.renderLecturaTiempoReal(data, evaluacion);

      // Excepción RF4: Notificar si sale del rango óptimo de las orquídeas
      if (data.conectado) {
        if (!evaluacion.humedadOptima) {
          this.view.mostrarAlerta(
            `Alerta de humedad: ${data.humedad.toFixed(1)}% (óptimo ~80%).`,
            "warn"
          );
        }
        if (!evaluacion.temperaturaOptima) {
          this.view.mostrarAlerta(
            `Alerta de temperatura: ${data.temperatura.toFixed(1)} °C (óptimo 18-24 °C).`,
            "warn"
          );
        }
      }
    });

    // RF5 (RF6): Sincronizar frecuencia configurada
    this.model.suscribirFrecuencia((segundos) => {
      this.frecuenciaSegundos = segundos;
      this.view.renderFrecuencia(segundos);
      if (this.sensorInterval) {
        this.iniciarGuardadoHistorico();
      }
    });

    // RF5 (RF6): Mostrar historial almacenado
    this.model.suscribirHistorial((registros) => {
      this.view.renderHistorial(registros, (h, t) => this.model.evaluarCondiciones(h, t));
    });

    // RF1 y RF2: Lista de horarios de riego
    this.model.suscribirRiegos((lista) => {
      this.calendariosActivos = lista;
      this.view.renderCalendarioRiego(lista, (id) => this.model.eliminarRiego(id));
    });
  }

  // --- Acciones disparadas por el usuario desde la Vista ---
  registrarEventosVista() {
    // RF3: Conectar sensores (simulado mientras llegan los físicos)
    this.view.bindConectarSensor((protocolo) => {
      this.protocoloActual = protocolo;
      this.view.renderBotonesSensor(true);

      const enviar = () => {
        const lectura = this.model.generarLecturaSimulada(
          this.escenarioSimulado,
          this.protocoloActual
        );
        this.ultimaLectura = lectura;
        this.model.guardarLecturaActual(lectura);
      };

      enviar();
      this.sensorInterval = setInterval(enviar, 3000);
      this.iniciarGuardadoHistorico();
      this.view.mostrarAlerta("Sensor conectado y transmitiendo datos en tiempo real.", "info");
    });

    this.view.bindDesconectarSensor(() => {
      clearInterval(this.sensorInterval);
      clearInterval(this.historyInterval);
      this.sensorInterval = null;
      this.view.renderBotonesSensor(false);

      this.model.guardarLecturaActual({
        ...this.ultimaLectura,
        conectado: false,
        timestamp: Date.now()
      });
    });

    // Excepción RF3: Fallo de conexión y guía de solución
    this.view.bindSimularFallo(() => {
      this.view.mostrarGuiaSolucion(true);
      this.view.mostrarAlerta("Fallo al emparejar sensor. Revisa la guía de solución.", "warn");
    });

    // Cambio de escenario para pruebas funcionales
    this.view.bindEscenarios((escenario) => {
      this.escenarioSimulado = escenario;
      this.view.mostrarAlerta(`Escenario simulado cambiado a: ${escenario.toUpperCase()}.`, "info");
    });

    // RF5 (RF6): Actualizar frecuencia de guardado histórico
    this.view.bindGuardarFrecuencia((segundos) => {
      this.model.guardarFrecuencia(segundos);
      this.view.mostrarAlerta(
        `Frecuencia de registro actualizada a cada ${segundos} segundos.`,
        "info"
      );
    });

    // RF1: Guardar nuevo horario de riego
    this.view.bindGuardarRiego(({ dias, hora, nota }) => {
      if (dias.length === 0) {
        this.view.mostrarAlerta("Selecciona al menos un día para el riego.", "warn");
        return false;
      }
      this.model.agregarRiego(dias, hora, nota);
      this.view.mostrarAlerta("Calendario de riego guardado en Firebase.", "info");
      return true;
    });

    // RF2: Solicitar permiso para notificaciones del navegador
    this.view.bindActivarNotificaciones(async () => {
      if (!("Notification" in window)) {
        return this.view.mostrarAlerta("Tu navegador no soporta notificaciones nativas.", "warn");
      }
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        this.view.mostrarAlerta("Notificaciones del navegador activadas.", "info");
      }
    });
  }

  // --- Registro histórico según la frecuencia elegida (RF5/RF6) ---
  iniciarGuardadoHistorico() {
    clearInterval(this.historyInterval);
    const registrar = () => {
      this.model.guardarRegistroHistorico(
        this.ultimaLectura.humedad,
        this.ultimaLectura.temperatura
      );
    };
    registrar();
    this.historyInterval = setInterval(registrar, this.frecuenciaSegundos * 1000);
  }

  // --- Verificador de horarios para notificar riego (RF2) ---
  iniciarVerificadorRiego() {
    const mapaDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    setInterval(() => {
      const ahora = new Date();
      const diaActual = mapaDias[ahora.getDay()];
      const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(
        ahora.getMinutes()
      ).padStart(2, "0")}`;
      const claveMinuto = `${diaActual}-${horaActual}`;

      // Evita repetir la misma notificación dentro del mismo minuto
      if (claveMinuto === this.ultimaNotifMinuto) return;

      this.calendariosActivos.forEach((c) => {
        if (c.dias.includes(diaActual) && c.hora === horaActual) {
          this.ultimaNotifMinuto = claveMinuto;
          this.view.mostrarAlerta(
            `¡Hora de regar las orquídeas! (${c.hora} - ${c.nota})`,
            "info"
          );
        }
      });
    }, 10000);
  }
}