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
    period: string;
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

const TEAL = "#01525e";
const LEVEL_INDEX: Record<ReportLevel, number> = {
  not_yet: 1,
  in_progress: 2,
  acquired: 3,
  mastered: 4,
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1b1b1b" },
  header: { borderBottomWidth: 2, borderBottomColor: TEAL, paddingBottom: 8, marginBottom: 14 },
  school: { fontSize: 9, color: "#555" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: TEAL, marginTop: 2 },
  student: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { fontSize: 9, color: "#444", marginTop: 2 },
  periodTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: TEAL, marginBottom: 6 },
  draft: { fontSize: 9, color: "#852624", marginBottom: 6 },
  domain: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#eef4f4",
    padding: 4,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  skill: { flex: 1, paddingRight: 6 },
  levelCell: { width: 150, flexDirection: "row", alignItems: "center" },
  boxes: { flexDirection: "row", marginRight: 6 },
  box: { width: 9, height: 9, marginRight: 2, borderWidth: 0.5, borderColor: TEAL },
  boxOn: { backgroundColor: TEAL },
  levelText: { fontSize: 8, color: "#333" },
  comment: { fontSize: 8, color: "#555", marginTop: 1 },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  legend: { fontSize: 8, color: "#555", marginTop: 12 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#777",
    textAlign: "center",
  },
});

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
                {labels.period} : {period.label} ({period.range})
              </Text>
              {period.hasDraft && <Text style={styles.draft}>{labels.draft}</Text>}
              {period.domains.length === 0 && <Text>{labels.noData}</Text>}
              {period.domains.map((group) => (
                <View key={group.domain} wrap={false}>
                  <Text style={styles.domain}>{group.domain}</Text>
                  {group.skills.map((skill, skillIndex) => (
                    <View key={skillIndex} style={styles.row}>
                      <View style={styles.skill}>
                        <Text>{skill.label}</Text>
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
