/* eslint-disable @next/next/no-img-element -- Profile photos are private, bounded data URLs. */
export function Avatar({
  name,
  photo,
  large = false,
}: {
  name: string;
  photo?: string | null;
  large?: boolean;
}) {
  return (
    <span className={`avatar ${large ? "avatar-large" : ""}`} title={name}>
      {photo ? (
        <img src={photo} alt={`${name}'s profile photo`} />
      ) : (
        name
          .split(" ")
          .map((word) => word[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
