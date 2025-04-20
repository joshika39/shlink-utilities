import { Form, ActionPanel, Action, Clipboard, showToast, getPreferenceValues, Toast } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useState } from "react";

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

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  async function _handleSubmit(values: Values) {
    if (!preferences.apiKey || !preferences.host) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid configuration",
        message: "Please set the API key and host in the extension preferences.",
      });
    }

    const url = `${preferences.protocol}://${preferences.host}/rest/v1/short-urls`;
    const apiKey = preferences.apiKey;
    const payload: Payload = {
      longUrl: values.url,
      validateUrl: false,
      findIfExists: true,
    };

    if (values.slug) {
      payload["slug"] = values.slug;
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Creating short URL...",
    });

    try {
      const response = await fetch(url, {
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

      const qrUrl = `https://l.kou-gen.net/${shortCode}/qr-code?size=300&format=png&margin=25&errorCorrection=Q&roundBlockSize=true&color=%23000098&bgColor=%23ffffff`;

      setShortUrl(shortUrl);
      setQrUrl(qrUrl);

      toast.style = Toast.Style.Success;
      toast.title = "Short URL created and copied to clipboard";
    } catch {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create short URL";
      toast.message = "Something went wrong while creating the short URL.";
    }
  }

  const { handleSubmit, itemProps } = useForm({
    onSubmit: _handleSubmit,
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
          <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
          <Action.CopyToClipboard title="Copy Short URL" content={shortUrl ?? ""} />
        </ActionPanel>
      }
    >
      <Form.Description title="Create a short URL" text="Enter the URL you want to shorten." />
      <Form.TextField title="URL" placeholder="https://example.com" {...itemProps.url} />
      <Form.TextField title="Slug" placeholder="Optional slug" {...itemProps.slug} />
      <Form.Checkbox
        title="Should generate QR Code?"
        label="Generate QR Code"
        storeValue
        {...itemProps.generateQRCode}
      />
    </Form>
  );
}
