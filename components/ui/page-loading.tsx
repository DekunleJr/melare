import { Loading } from "./misc";

/*
 * Used as loading.tsx in every admin and account page folder. Each folder needs its
 * own boundary so that moving between pages responds at once.
 */
export default function PageLoading() {
  return <Loading />;
}
