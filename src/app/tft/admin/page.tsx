"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/lib/kv";

const REGION = "la2";

export default function TftAdmin() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [riotId, setRiotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    fetch("/api/tft/players")
      .then((res) => res.json())
      .then((data) => setPlayers(data.players ?? []));
  };

  useEffect(load, []);

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/tft/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotId, region: REGION }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    setRiotId("");
    load();
  };

  const removePlayer = async (id: string) => {
    await fetch("/api/tft/players", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#111827] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1">Admin TFT</h1>
        <p className="text-white/40 mb-8">Agregar o sacar jugadores del tracker de TFT</p>

        <form
          onSubmit={addPlayer}
          className="flex flex-col sm:flex-row gap-3 mb-8"
        >
          <input
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            placeholder="NombreInvocador#TAG"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-2 font-medium text-black transition"
          >
            {submitting ? "Agregando..." : "Agregar"}
          </button>
        </form>

        {error && <p className="text-red-400 mb-6">{error}</p>}

        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="text-white">
                {p.game_name}
                <span className="text-white/40">#{p.tag_line}</span>{" "}
                <span className="text-white/30 text-sm">({p.region})</span>
              </span>
              <button
                onClick={() => removePlayer(p.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
