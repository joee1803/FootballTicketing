export function StatusPill({ status, valid }) {
  const tone = valid ? "statusOk" : "statusWarn";

  return <span className={`statusPill ${tone}`}>{status}</span>;
}
