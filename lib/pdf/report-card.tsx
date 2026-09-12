import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * Skills report card ("livret") rendered server-side with @react-pdf/renderer.
 * Pure data in, PDF bytes out: labels are translated by the caller.
 */
export type ReportLevel = "not_yet" | "in_progress" | "acquired" | "mastered";

export type ReportSkill = {
  label: string;
  level: ReportLevel | null;
  score: string | null;
  comment: string | null;
  published: boolean;
};

export type ReportPeriod = {
  label: string;
  range: string;
  domains: Array<{ domain: string; skills: ReportSkill[] }>;
  remark: string | null;
  absences: { days: number; lates: number };
  hasDraft: boolean;
};

export type ReportCardData = {
  appName: string;
  school: string;
  student: { firstName: string; lastName: string; birthDate: string | null };
  className: string;
  levelLabel: string;
  teachers: string[];
  periods: ReportPeriod[];
  generatedAt: string;
  labels: {
    title: string;
    born: string | null;
    classLabel: string;
    teacher: string;
    legend: string;
    levels: Record<ReportLevel, string>;
    remark: string;
    absences: string;
    absencesText: (absences: { days: number; lates: number }) => string;
    none: string;
    draft: string;
    noData: string;
    generatedOn: string;
    confidentiality: string;
  };
};

/*
 * The booklet is the one thing of this application a family keeps on paper, and
 * it was still printed in the teal of the first two sessions — the charter
 * changed to the blues of the flag in session 16 (ADR-0032) and nothing here
 * followed, because nobody opens a PDF twice. Times-Roman carries the titles:
 * @react-pdf ships it, it costs no font file, and the serif is the school's
 * voice in the application.
 */
const INK = "#0f1e33";
const BLUE = "#0038b8";
const MUTED = "#55657c";
const RULE = "#becadc";
const LEVEL_INDEX: Record<ReportLevel, number> = {
  not_yet: 1,
  in_progress: 2,
  acquired: 3,
  mastered: 4,
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: INK },
  header: { borderBottomWidth: 1, borderBottomColor: RULE, paddingBottom: 10, marginBottom: 16 },
  school: { fontSize: 8, color: BLUE, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 22, fontFamily: "Times-Roman", color: INK, marginTop: 4 },
  student: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 10 },
  meta: { fontSize: 9, color: MUTED, marginTop: 2 },
  periodTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: INK,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  draft: { fontSize: 9, color: "#852624", marginBottom: 6 },
  // a rule, not a tinted block: the same choice the screens made in session 22
  domain: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 3,
    marginTop: 14,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 4,
  },
  skill: { flex: 1, paddingRight: 8 },
  levelCell: { width: 150, flexDirection: "row", alignItems: "center" },
  boxes: { flexDirection: "row", marginRight: 8 },
  box: { width: 9, height: 9, marginRight: 2, borderWidth: 0.5, borderColor: BLUE },
  boxOn: { backgroundColor: BLUE },
  levelText: { fontSize: 8, color: MUTED },
  comment: { fontSize: 8, color: MUTED, marginTop: 1 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  legend: { fontSize: 8, color: MUTED, marginTop: 14 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
  },
});

/** A catalogue that repeats the domain in every label — the seed did, and an
 * imported one may — printed "Mobiliser le langage · Comprendre les consignes"
 * under a heading already reading "Mobiliser le langage". */
function withoutDomain(label: string, domain: string): string {
  const prefix = `${domain} · `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

function LevelBoxes({ level }: { level: ReportLevel | null }) {
  const filled = level ? LEVEL_INDEX[level] : 0;
  return (
    <View style={styles.boxes}>
      {[1, 2, 3, 4].map((index) => (
        <View key={index} style={index <= filled ? [styles.box, styles.boxOn] : styles.box} />
      ))}
    </View>
  );
}

export function ReportCardDocument({ data }: { data: ReportCardData }) {
  const { labels } = data;
  const fullName = `${data.student.firstName} ${data.student.lastName}`;
  return (
    <Document title={`${labels.title} — ${fullName}`} author={data.appName} language="fr">
      {(data.periods.length > 0 ? data.periods : [null]).map((period, index) => (
        <Page key={period?.label ?? index} size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.school}>{data.school}</Text>
            <Text style={styles.title}>{labels.title}</Text>
            <Text style={styles.student}>{fullName}</Text>
            <Text style={styles.meta}>
              {[labels.born, `${labels.classLabel} : ${data.className} (${data.levelLabel})`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {data.teachers.length > 0 && (
              <Text style={styles.meta}>
                {labels.teacher} : {data.teachers.join(", ")}
              </Text>
            )}
          </View>

          {period ? (
            <>
              <Text style={styles.periodTitle}>
                {/* "Période : Période 1" — the label repeated the name of the
                    thing it labels. The period already says what it is. */}
                {period.label} · {period.range}
              </Text>
              {period.hasDraft && <Text style={styles.draft}>{labels.draft}</Text>}
              {period.domains.length === 0 && <Text>{labels.noData}</Text>}
              {period.domains.map((group) => (
                <View key={group.domain} wrap={false}>
                  <Text style={styles.domain}>{group.domain}</Text>
                  {group.skills.map((skill, skillIndex) => (
                    <View key={skillIndex} style={styles.row}>
                      <View style={styles.skill}>
                        <Text>{withoutDomain(skill.label, group.domain)}</Text>
                        {skill.comment && <Text style={styles.comment}>{skill.comment}</Text>}
                      </View>
                      <View style={styles.levelCell}>
                        <LevelBoxes level={skill.level} />
                        <Text style={styles.levelText}>
                          {skill.level ? labels.levels[skill.level] : ""}
                          {skill.score ? ` ${skill.score}` : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{labels.remark}</Text>
                <Text>{period.remark ?? labels.none}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{labels.absences}</Text>
                <Text>{labels.absencesText(period.absences)}</Text>
              </View>
              <Text style={styles.legend}>{labels.legend}</Text>
            </>
          ) : (
            <Text>{labels.noData}</Text>
          )}

          <Text style={styles.footer} fixed>
            {labels.generatedOn} · {labels.confidentiality}
          </Text>
        </Page>
      ))}
    </Document>
  );
}

export async function renderReportCard(data: ReportCardData): Promise<Buffer> {
  return renderToBuffer(<ReportCardDocument data={data} />);
}
