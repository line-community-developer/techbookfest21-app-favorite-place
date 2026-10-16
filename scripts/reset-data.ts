// 撮影や動作確認の前に、登録した場所・写真・コメント・会話の状態をすべて消すスクリプト。
// テーブルは残し、中身だけ消す。元に戻せないので、本番の運用データがあるプロジェクトでは実行しない。
//
// 実行方法:
//   npm run reset-data
import { createServiceRoleClient } from "@/lib/supabase";

async function main() {
  const supabase = createServiceRoleClient();

  // 写真の実体（Storage）を先に消す。place_photos の行が消えるとパスがわからなくなるため
  const { data: photos, error: photosError } = await supabase.from("place_photos").select("storage_path");
  if (photosError) throw photosError;
  if (photos.length > 0) {
    const { error } = await supabase.storage.from("place-photos").remove(photos.map((p) => p.storage_path));
    if (error) throw error;
  }

  // line_users を消すと places → place_photos / place_comments も外部キーの cascade で消える
  const { error: usersError, count } = await supabase
    .from("line_users")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (usersError) throw usersError;

  console.log(`写真 ${photos.length} 枚と、ユーザー ${count ?? 0} 人分のデータを消しました。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
