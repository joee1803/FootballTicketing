export function SectionCard({ title, description, children }) {
  return (
    <section className="panel sectionCard">
      <div className="sectionHeading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
