import { db } from "../config/firebase.js";
import {
  ref,
  set,
  push,
  remove,
  onValue,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export class InvernaderoModel {
  constructor() {
    // Nodos principales en Firebase Realtime Database
    this.lecturaActualRef = ref(db, "lectura_actual");
    this.historialRef = ref(db, "historial");
    this.frecuenciaRef = ref(db, "configuracion/frecuencia_segundos");
    this.riegoRef = ref(db, "calendario_riego");

    // Parámetros óptimos del caso (orquídeas)
    this.RANGOS = {
      humMin: 75,
      humMax: 85, // Alrededor del 80%
      tempMin: 18,
      tempMax: 24 // 18°C - 24°C (noche - día)
    };
  }

  // --- Validación de rangos óptimos (RF4) ---
  evaluarCondiciones(humedad, temperatura) {
    return {
      humedadOptima: humedad >= this.RANGOS.humMin && humedad <= this.RANGOS.humMax,
      temperaturaOptima: temperatura >= this.RANGOS.tempMin && temperatura <= this.RANGOS.tempMax
    };
  }

  // --- Simulador temporal mientras llegan los sensores físicos ---
  generarLecturaSimulada(escenario, protocolo) {
    let humedad = 80 + (Math.random() * 4 - 2);      // 78% - 82%
    let temperatura = 21 + (Math.random() * 2 - 1);  // 20°C - 22°C

    if (escenario === "seco") {
      humedad = 54 + Math.random() * 3;              // Fuerza alerta de humedad baja
    }
    if (escenario === "calor") {
      temperatura = 28.5 + Math.random() * 1.5;      // Fuerza alerta de temperatura alta
    }

    return {
      humedad: Number(humedad.toFixed(1)),
      temperatura: Number(temperatura.toFixed(1)),
      protocolo,
      conectado: true,
      timestamp: Date.now()
    };
  }

  // --- Lectura en tiempo real (RF3, RF4, RF7/RF8) ---
  guardarLecturaActual(lectura) {
    return set(this.lecturaActualRef, lectura);
  }

  suscribirLecturaActual(callback) {
    onValue(this.lecturaActualRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  }

  // --- Registro histórico y frecuencia configurable (RF5/RF6) ---
  guardarRegistroHistorico(humedad, temperatura) {
    return push(this.historialRef, {
      humedad,
      temperatura,
      timestamp: Date.now()
    });
  }

  suscribirHistorial(callback, limite = 20) {
    const consulta = query(this.historialRef, limitToLast(limite));
    onValue(consulta, (snapshot) => {
      const registros = snapshot.exists() ? Object.values(snapshot.val()) : [];
      callback(registros);
    });
  }

  guardarFrecuencia(segundos) {
    return set(this.frecuenciaRef, Number(segundos));
  }

  suscribirFrecuencia(callback) {
    onValue(this.frecuenciaRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(Number(snapshot.val()));
      }
    });
  }

  // --- Calendario de riego (RF1 y RF2) ---
  agregarRiego(dias, hora, nota) {
    return push(this.riegoRef, { dias, hora, nota });
  }

  eliminarRiego(id) {
    return remove(ref(db, `calendario_riego/${id}`));
  }

  suscribirRiegos(callback) {
    onValue(this.riegoRef, (snapshot) => {
      const lista = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, datos]) => ({ id, ...datos }))
        : [];
      callback(lista);
    });
  }
}