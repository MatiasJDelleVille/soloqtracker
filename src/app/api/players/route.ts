import { NextRequest, NextResponse } from "next/server";
import { addPlayer, getPlayers, removePlayer } from "@/lib/kv";
import { getAccountByRiotId, PLATFORMS } from "@/lib/riot";

const KEY = "players:lol";

export async function GET() {
  const players = await getPlayers(KEY);
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { riotId, region } = body as { riotId: string; region: string };

  if (!riotId?.includes("#")) {
    return NextResponse.json(
      { error: "Formato inválido. Usá NombreDeInvocador#TAG" },
      { status: 400 }
    );
  }
  if (!PLATFORMS.includes(region)) {
    return NextResponse.json({ error: "Región inválida" }, { status: 400 });
  }

  const [gameName, tagLine] = riotId.split("#");

  try {
    const account = await getAccountByRiotId(gameName, tagLine, region);

    const player = await addPlayer(KEY, {
      game_name: account.gameName,
      tag_line: account.tagLine,
      puuid: account.puuid,
      region,
    });

    return NextResponse.json({ player });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id: string };
  await removePlayer(KEY, id);
  return NextResponse.json({ ok: true });
}
