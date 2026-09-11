import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { HelpBlock } from "@/lib/help/outline";

const TEAL = "#01525e";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1b1b1b", lineHeight: 1.4 },
  app: { fontSize: 9, color: "#555" },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  topic: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginTop: 18,
    marginBottom: 2,
    borderTopWidth: 1,
    borderTopColor: "#d9d9d9",
    paddingTop: 8,
  },
  heading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
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

export type GuideArticle = { title: string; blocks: HelpBlock[] };
export type GuideTopic = { heading: string; articles: GuideArticle[] };

export type GuideData = {
  appName: string;
  title: string;
  subtitle: string;
  topics: GuideTopic[];
  footer: string;
};

function Blocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === "bullet" ? (
          <View key={index} style={styles.bullet}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.bulletText}>{block.text}</Text>
          </View>
        ) : (
          <Text key={index} style={styles.paragraph}>
            {block.text}
          </Text>
        ),
      )}
    </>
  );
}

/**
 * "My guide": every article this reader sees on `/aide`, in the same order,
 * under the same topic headings — one document per person rather than one per
 * file, since the articles are now cut by question and not by role (ADR-0044).
 */
export function GuideDocument({ data }: { data: GuideData }) {
  return (
    <Document title={data.title} author={data.appName} language="fr">
      <Page size="A4" style={styles.page}>
        <Text style={styles.app}>{data.appName}</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.subtitle}</Text>
        {data.topics.map((topic) => (
          <View key={topic.heading}>
            <Text style={styles.topic}>{topic.heading}</Text>
            {topic.articles.map((article) => (
              // `wrap={false}` kept a long article whole and pushed a mostly
              // empty page before it; only the title stays with its first lines.
              <View key={article.title}>
                <Text style={styles.heading} minPresenceAhead={40}>
                  {article.title}
                </Text>
                <Blocks blocks={article.blocks} />
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
