"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import liff from "@line/liff";
import { ensureLiffInitialized, ensureLoggedIn, getAuthorizedFetchHeaders } from "@/lib/liff-client";

type PlaceDetail = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  title: string | null;
  createdAt: string;
};

type PhotoItem = { id: string; url: string | null; createdAt: string };
type CommentItem = { id: string; body: string; created_at: string };

type PlaceDetailResponse = {
  place: PlaceDetail;
  photos: PhotoItem[];
  comments: CommentItem[];
};

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PlaceDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [confirmingShare, setConfirmingShare] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureLiffInitialized();
        if (!ensureLoggedIn()) return;

        const response = await fetch(`/api/places/${params.id}`, {
          headers: getAuthorizedFetchHeaders(),
        });
        if (!response.ok) {
          throw new Error("場所の取得に失敗しました。");
        }
        const body = (await response.json()) as PlaceDetailResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "エラーが発生しました。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleShareConfirmed() {
    if (!data) return;
    setConfirmingShare(false);

    // #@@range_begin(wow_share)
    if (!liff.isApiAvailable("shareTargetPicker")) {
      setShareMessage("この環境では共有機能を利用できません。");
      return;
    }

    try {
      const result = await liff.shareTargetPicker([
        {
          type: "location",
          title: data.place.title || "好きな場所",
          address: data.place.address || "",
          latitude: data.place.latitude,
          longitude: data.place.longitude,
        },
      ]);
      setShareMessage(result ? "共有しました。" : "共有をキャンセルしました。");
    // #@@range_end(wow_share)
    } catch {
      setShareMessage("共有に失敗しました。");
    }
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md p-4">
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      </main>
    );
  }
  if (!data) {
    return <p className="animate-pulse py-10 text-center text-sm text-slate-500">読み込み中...</p>;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <Link href="/liff" className="text-sm font-semibold text-line-dark">
        ‹ 地図にもどる
      </Link>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">{data.place.title || "登録した場所"}</h1>
        {data.place.address && <p className="mt-1 text-sm text-slate-600">{data.place.address}</p>}
        <p className="mt-1 text-xs text-slate-400">
          {data.place.latitude}, {data.place.longitude}
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-500">📷 写真 {data.photos.length}枚</h2>
        {data.photos.length === 0 && <p className="text-sm text-slate-400">まだ写真がありません。</p>}
        <div className="grid grid-cols-3 gap-2">
          {data.photos.map((photo) =>
            photo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photo.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
            ) : null
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-500">💬 コメント {data.comments.length}件</h2>
        {data.comments.length === 0 && <p className="text-sm text-slate-400">まだコメントがありません。</p>}
        <ul className="flex flex-col gap-2">
          {data.comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
              {comment.body}
            </li>
          ))}
        </ul>
      </section>

      {/* 自分の位置情報を送信する操作なので、確認を挟んでから shareTargetPicker を呼ぶ */}
      {!confirmingShare && (
        <button
          type="button"
          onClick={() => setConfirmingShare(true)}
          className="rounded-xl bg-line py-3 font-bold text-white active:bg-line-dark"
        >
          この場所を共有する
        </button>
      )}
      {confirmingShare && (
        <div role="alertdialog" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            「{data.place.title || "この場所"}」の位置情報を友だち・グループに共有します。よろしいですか？
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleShareConfirmed}
              className="flex-1 rounded-lg bg-line py-2 font-bold text-white active:bg-line-dark"
            >
              共有する
            </button>
            <button
              type="button"
              onClick={() => setConfirmingShare(false)}
              className="flex-1 rounded-lg bg-white py-2 font-bold text-slate-600 ring-1 ring-slate-300"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      {shareMessage && <p className="text-center text-sm text-slate-600">{shareMessage}</p>}
    </main>
  );
}
