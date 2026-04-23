export function SectionCard({ id = null, title, description, children, eyebrow = null, actions = null, className = "" }) {
  return (
    <section id={id} className={`panel sectionCard ${className}`.trim()}>
      <div className="sectionHeading">
        <div>
          {eyebrow ? <p className="sectionEyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="sectionHeadingActions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
