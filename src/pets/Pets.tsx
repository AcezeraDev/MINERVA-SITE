import { useEffect } from "react";
import "./pets.css";
import { startPets } from "./engine";

/**
 * Monta a Mine andando por cima do site. Carregado sob demanda (React.lazy em
 * main.tsx) e só quando os pets estão ligados e o aparelho/preferência permite
 * movimento — então quem desliga não baixa nem roda nada disto.
 */
export default function Pets() {
  useEffect(() => {
    const handle = startPets();
    return () => handle.destroy();
  }, []);
  return null;
}
