import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { GuideSection } from "@/lib/guides";

const TEAL = "#01525e";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1b1b1b", lineHeight: 1.4 },
  app: { fontSize: 9, color: "#555" },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginTop: 4,
    marginBottom: 14,
  },
  heading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: { marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 3, paddingLeft: 6 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#777",
    textAlign: "center",
  },
});

export type GuideData = {
  appName: string;
  title: string;
  sections: GuideSection[];
  footer: string;
};

export function GuideDocument({ data }: { data: GuideData }) {
  return (
    <Document title={data.title} author={data.appName} language="fr">
      <Page size="A4" style={styles.page}>
        <Text style={styles.app}>{data.appName}</Text>
        <Text style={styles.title}>{data.title}</Text>
        {data.sections.map((section) => (
          <View key={section.heading} wrap={false}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.bullets.map((bullet, index) => (
              <View key={index} style={styles.bullet}>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${data.footer} · ${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function renderGuide(data: GuideData): Promise<Buffer> {
  return renderToBuffer(<GuideDocument data={data} />);
}
