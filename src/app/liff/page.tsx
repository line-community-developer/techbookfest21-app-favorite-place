"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureLiffInitialized, ensureLoggedIn, getAuthorizedFetchHeaders } from "@/lib/liff-client";
import { loadGoogleMapsScript } from "@/lib/google-maps-loader";

type PlaceListItem = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  title: string | null;
  created_at: string;
};

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅
const INIT_TIMEOUT_MS = 10_000;

// どこで止まっているかを画面に出す。サーバーで描画した直後は "hydrate"（JS がまだ動いていない）
type Stage = "hydrate" | "init" | "login" | "fetch" | "done";
const STAGE_LABEL: Record<Stage, string> = {
  hydrate: "JavaScript の起動待ち",
  init: "liff.init() を実行中",
  login: "LINE ログインへ移動中",
  fetch: "/api/places を取得中",
  done: "完了",
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function LiffMapPage() {
  const [places, setPlaces] = useState<PlaceListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("hydrate");
  const [problems, setProblems] = useState<string[]>([]);

  // CSP 違反や捕まえていない例外も画面に出す（LINE アプリ内ではコンソールを見られないため）
  useEffect(() => {
    const add = (message: string) => setProblems((prev) => [...prev, message].slice(-5));
    const onCsp = (e: SecurityPolicyViolationEvent) => add(`CSP: ${e.violatedDirective} ${e.blockedURI}`);
    const onError = (e: ErrorEvent) => add(`Error: ${e.message}`);
    const onRejection = (e: PromiseRejectionEvent) => add(`Unhandled: ${String(e.reason)}`);
    document.addEventListener("securitypolicyviolation", onCsp);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      document.removeEventListener("securitypolicyviolation", onCsp);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStage("init");
        await withTimeout(
          ensureLiffInitialized(),
          INIT_TIMEOUT_MS,
          "liff.init() が10秒たっても終わりません。LIFF ID とエンドポイントURLが一致しているか確認してください。"
        );
        if (!ensureLoggedIn()) {
          setStage("login");
          return; // liff.login() がリダイレクトするのでここで終了
        }

        setStage("fetch");
        const response = await fetch("/api/places", {
          headers: getAuthorizedFetchHeaders(),
        });
        if (!response.ok) {
          throw new Error(`場所一覧の取得に失敗しました（HTTP ${response.status}）。`);
        }
        const body = (await response.json()) as { places: PlaceListItem[] };
        if (!cancelled) {
          setPlaces(body.places);
          setStage("done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "エラーが発生しました。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">📍 好きな場所マップ</h1>
        {places && (
          <span className="rounded-full bg-line/10 px-3 py-1 text-xs font-semibold text-line-dark">
            {places.length}件
          </span>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && places === null && (
        <p className="animate-pulse py-10 text-center text-sm text-slate-500">
          読み込み中...（{STAGE_LABEL[stage]}）
        </p>
      )}
      {problems.length > 0 && (
        <ul className="list-disc rounded-lg bg-red-50 py-2 pr-3 pl-6 text-xs text-red-700">
          {problems.map((problem, i) => (
            <li key={i}>{problem}</li>
          ))}
        </ul>
      )}

      {places && places.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          まだ場所が登録されていません。
          <br />
          トークで「登録」と送って始めましょう。
        </p>
      )}
      {places && places.length > 0 && (
        <>
          <MapView places={places} />
          <ul className="flex flex-col gap-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/liff/places/${place.id}`}
                  className="block rounded-xl bg-white p-3 shadow-sm active:bg-slate-100"
                >
                  <p className="font-semibold">{place.title || "名前のない場所"}</p>
                  <p className="text-xs text-slate-500">{place.address || `${place.latitude}, ${place.longitude}`}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function MapView({ places }: { places: PlaceListItem[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadGoogleMapsScript();
      if (cancelled || !mapContainerRef.current) return;

      const first = places[0];
      const center = first ? { lat: first.latitude, lng: first.longitude } : DEFAULT_CENTER;

      const map = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 12,
      });

      for (const place of places) {
        const marker = new google.maps.Marker({
          position: { lat: place.latitude, lng: place.longitude },
          map,
          title: place.title ?? undefined,
        });
        marker.addListener("click", () => {
          router.push(`/liff/places/${place.id}`);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [places, router]);

  return <div ref={mapContainerRef} className="h-[55vh] w-full overflow-hidden rounded-xl shadow-sm" />;
}
