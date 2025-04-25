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
import { useState } from "react";

interface Preferences {
  protocol: string;
  apiKey?: string;
  host?: string;
  qrCodeBgColor?: string;
  qrCodeColor?: string;
  qrCodeErrorCorrectionLevel?: string;
  qrCodeSize?: string;
}

type Values = {
  url: string;
  slug?: string;
  generateQRCode?: boolean;
  qrCodeBgColor: string;
  qrCodeColor: string;
  qrCodeErrorCorrection: string;
  qrCodeMargin?: string;
  qrCodeSize: string;
  qrCodeLogoEnabled?: boolean;
};

type Payload = {
  longUrl: string;
  validateUrl: boolean;
  findIfExists: boolean;
  customSlug?: string;
};

export function ResultDetails({ shortUrl, qrUrl }: { shortUrl: string; qrUrl: string }) {
  const { data, isLoading } = useFetch<ArrayBuffer>(qrUrl, {
    headers: { "Content-Type": "image/png" },
    parseResponse: async (response) => {
      return await response.arrayBuffer();
    },
  });

  async function copyImageFile() {
    if (!data || !(data instanceof ArrayBuffer)) {
      return;
    }

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

  const base64Image =
    data instanceof ArrayBuffer ? `data:image/png;base64,${Buffer.from(data).toString("base64")}` : "";

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

  const [shortUrl, setShortUrl] = useState<string | null>(null);

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
      };

      if (values.slug) {
        payload.customSlug = values.slug;
      }

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

        setShortUrl(shortUrl);

        let qrUrl = `https://l.kou-gen.net/${shortCode}/qr-code`;

        if (values.generateQRCode) {
          const queryParams = new URLSearchParams({
            bgColor: values.qrCodeBgColor,
            color: values.qrCodeColor,
            errorCorrection: values.qrCodeErrorCorrection,
            margin: values.qrCodeMargin || "25",
            size: values.qrCodeSize,
          });

          if (!values.qrCodeLogoEnabled) {
            queryParams.append("logo", "disable");
          }

          qrUrl = `${qrUrl}?${queryParams.toString()}`;
        }

        toast.style = Toast.Style.Success;
        toast.title = "Short URL created";
        toast.message = `Short URL: ${shortUrl}`;
        if (values.generateQRCode) {
          push(<ResultDetails shortUrl={shortUrl} qrUrl={qrUrl} />);
        }
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
      qrCodeBgColor: preferences.qrCodeBgColor || "#ffffff",
      qrCodeColor: preferences.qrCodeColor || "#000000",
      qrCodeErrorCorrection: preferences.qrCodeErrorCorrectionLevel || "L",
      qrCodeMargin: "25",
      qrCodeSize: preferences.qrCodeSize || "300",
      qrCodeLogoEnabled: true,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Short URL" onSubmit={handleSubmit} />
          {itemProps.url.value && (
            <Action.CopyToClipboard
              title="Copy URL to Clipboard"
              content={shortUrl || ""}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Description title="Create a short URL" text="Enter the URL to shorten and optionally generate a QR code." />
      <Form.TextField title="URL" placeholder="https://example.com" {...itemProps.url} />
      <Form.TextField title="Slug" placeholder="Optional slug" {...itemProps.slug} />
      <Form.Checkbox title="Generate QR Code" label="Yes" {...itemProps.generateQRCode} />
      {itemProps.generateQRCode.value && (
        <>
          <Form.Separator />
          <Form.Description title="QR Code Options" text="Customize the QR code appearance." />
          <Form.TextField title="QR Code Background Color" placeholder="#ffffff" {...itemProps.qrCodeBgColor} />
          <Form.TextField title="QR Code Color" placeholder="#000000" {...itemProps.qrCodeColor} />
          <Form.Dropdown title="QR Code Error Correction" {...itemProps.qrCodeErrorCorrection}>
            <Form.Dropdown.Item value="L" title="Low (7% error correction)" />
            <Form.Dropdown.Item value="M" title="Medium (15% error correction)" />
            <Form.Dropdown.Item value="Q" title="Quartile (25% error correction)" />
            <Form.Dropdown.Item value="H" title="High (30% error correction)" />
          </Form.Dropdown>
          <Form.TextField title="QR Code Margin" placeholder="25" {...itemProps.qrCodeMargin} />
          <Form.TextField title="QR Code Size" placeholder="300" {...itemProps.qrCodeSize} />
          <Form.Checkbox title="QR Code Logo" label={"Do you want to add a logo?"} {...itemProps.qrCodeLogoEnabled} />
        </>
      )}
    </Form>
  );
}
