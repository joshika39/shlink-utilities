import {
  Form,
  ActionPanel,
  Action,
  showToast,
  getPreferenceValues,
  Toast,
  useNavigation,
  Clipboard,
  Detail,
  Icon,
} from "@raycast/api";
import { FormValidation, useFetch, useForm } from "@raycast/utils";
import { writeFile } from "fs/promises";
import os from "os";
import path from "path";

interface Preferences {
  protocol: string;
  apiKey?: string;
  host?: string;
}

type Values = {
  url: string;
  slug?: string;
  generateQRCode?: boolean;
};

type Payload = {
  longUrl: string;
  validateUrl: boolean;
  findIfExists: boolean;
  slug?: string;
};

export function ResultDetails({ shortUrl, qrUrl }: { shortUrl: string; qrUrl: string }) {
  const { data, isLoading } = useFetch<ArrayBuffer>(qrUrl, {
    headers: { "Content-Type": "image/png" },
    parseResponse: async (response) => {
      return await response.arrayBuffer();
    },
  });

  async function copyImageFile() {
    if (!data) return;

    const tempPath = path.join(os.tmpdir(), "qr-code.png");
    try {
      await writeFile(tempPath, Buffer.from(data));
      await Clipboard.copy({ file: tempPath });
      await showToast({ style: Toast.Style.Success, title: "QR Code image copied to clipboard" });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to copy image",
        message: String(err),
      });
    }
  }

  const base64Image = data ? `data:image/png;base64,${Buffer.from(data).toString("base64")}` : "";

  return (
    <Detail
      isLoading={isLoading}
      markdown={base64Image ? `![QR Code](${base64Image})\n\n[Visit Short URL](${shortUrl})` : ""}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy URL to Clipboard" content={shortUrl} />
          <Action title="Copy Image to Clipboard" onAction={copyImageFile} icon={Icon.Clipboard} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const { push } = useNavigation();

  const { handleSubmit, itemProps } = useForm<Values>({
    onSubmit: async (values) => {
      if (!preferences.apiKey || !preferences.host) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid configuration",
          message: "Please set the API key and host in the extension preferences.",
        });
        return;
      }

      const apiUrl = `${preferences.protocol}://${preferences.host}/rest/v1/short-urls`;
      const apiKey = preferences.apiKey;
      const payload: Payload = {
        longUrl: values.url,
        validateUrl: false,
        findIfExists: true,
        slug: values.slug,
      };

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Creating short URL...",
      });

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        const shortUrl = data.shortUrl;
        const shortCode = shortUrl.split("/").pop();

        const qrUrl = values.generateQRCode
          ? `https://l.kou-gen.net/${shortCode}/qr-code?size=300&format=png&margin=25&errorCorrection=Q&roundBlockSize=true&color=%23000098&bgColor=%23ffffff`
          : "";

        toast.style = Toast.Style.Success;
        toast.title = "Short URL created";
        push(<ResultDetails shortUrl={shortUrl} qrUrl={qrUrl} />);
      } catch {
        toast.style = Toast.Style.Failure;
        toast.title = "Failed to create short URL";
        toast.message = "An error occurred. Check your API settings or try again.";
      }
    },
    validation: {
      url: FormValidation.Required,
    },
    initialValues: {
      url: "",
      generateQRCode: true,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Short URL" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Create a short URL" text="Enter the URL to shorten and optionally generate a QR code." />
      <Form.TextField title="URL" placeholder="https://example.com" {...itemProps.url} />
      <Form.TextField title="Slug" placeholder="Optional slug" {...itemProps.slug} />
      <Form.Checkbox title="Generate QR Code" label="Yes" {...itemProps.generateQRCode} />
    </Form>
  );
}
