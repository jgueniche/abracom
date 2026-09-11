import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { HelpBlock } from "@/lib/help/outline";

const TEAL = "#01525e";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, fontFamily: "Helvetica", color: "#1b1b1b", lineHeight: 1.4 },
  /**
   * A running head, not a footer.
   *
   * `position: absolute` + `fixed` + `render` is the one combination
   * @react-pdf cannot lay out: past a dozen pages it translates a text block by
   * -8.7e21 points and throws "unsupported number". The three guides of session
   * 15 were one or two pages each and never reached it; "mon guide" is a dozen
   * for the direction, so the page number moved to a fixed line in the flow.
   */
  head: {
    fontSize: 8,
    color: "#777",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e4",
    paddingBottom: 4,
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: TEAL, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 8 },
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
  heading: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  paragraph: { marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 3, paddingLeft: 6 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
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
 * file, since the articles are now cut by question and not by role (ADR-0048).
 */
export function GuideDocument({ data }: { data: GuideData }) {
  return (
    <Document title={data.title} author={data.appName} language="fr">
      <Page size="A4" style={styles.page}>
        <Text
          style={styles.head}
          fixed
          render={({ pageNumber, totalPages }) => `${data.footer} · ${pageNumber} / ${totalPages}`}
        />
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.subtitle}</Text>
        {/* Flat on purpose: a wrapping View per topic, nested in the page, was
            the other half of the layout failure described above. */}
        {data.topics.flatMap((topic) => [
          <Text key={topic.heading} style={styles.topic}>
            {topic.heading}
          </Text>,
          ...topic.articles.flatMap((article) => [
            <Text key={`${topic.heading}/${article.title}`} style={styles.heading}>
              {article.title}
            </Text>,
            <Blocks key={`${topic.heading}/${article.title}/body`} blocks={article.blocks} />,
          ]),
        ])}
      </Page>
    </Document>
  );
}

export async function renderGuide(data: GuideData): Promise<Buffer> {
  return renderToBuffer(<GuideDocument data={data} />);
}
