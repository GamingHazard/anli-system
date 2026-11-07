import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  importLegacyAssets,
  listAssets,
  uploadCompanyLogo,
} from "@/lib/user-api";
import type { AssetEvent, CompanyAsset } from "@/lib/erp";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asset API client", () => {
  it("sends asset filters and returns paginated records", async () => {
    const payload = { assets: [], nextCursor: "cursor-1" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listAssets({
        category: "Vehicles",
        status: "Active",
        search: "van",
      }),
    ).resolves.toEqual(payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const query = new URL(url).searchParams;
    expect(new URL(url).pathname).toBe("/api/assets");
    expect(query.get("limit")).toBe("200");
    expect(query.get("category")).toBe("Vehicles");
    expect(query.get("status")).toBe("Active");
    expect(query.get("search")).toBe("van");
    expect(init.credentials).toBe("include");
  });

  it("surfaces asset API authorization failures without a success fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: "You do not have permission." }, 403),
        ),
    );

    await expect(listAssets()).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "You do not have permission.",
    } satisfies Partial<ApiError>);
  });

  it("requests signed Cloudinary params before uploading a company logo", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
          apiKey: "demo-key",
          timestamp: 1234567890,
          signature: "abc123",
          publicId: "logo-123",
          folder: "anli/company-profile",
          cloudName: "demo",
          resourceType: "image",
          type: "upload",
          maxBytes: 2 * 1024 * 1024,
          allowedFormats: ["png", "jpeg", "webp"],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/logo-123.png",
          public_id: "logo-123",
          resource_type: "image",
          format: "png",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          logo: {
            url: "https://res.cloudinary.com/demo/image/upload/logo-123.png",
            publicId: "logo-123",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadCompanyLogo(file)).resolves.toMatchObject({
      logo: {
        url: "https://res.cloudinary.com/demo/image/upload/logo-123.png",
        publicId: "logo-123",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/uploads/signed");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.cloudinary.com/v1_1/demo/image/upload",
    );
    const form = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("public_id")).toBe("logo-123");
    expect(form.get("api_key")).toBe("demo-key");
  });

  it("sends legacy asset and event records together for server-side idempotent import", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          imported: 1,
          importedEvents: 1,
          duplicates: 0,
          rejected: [],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const asset = { id: "legacy-asset", assetTag: "AST-001" } as CompanyAsset;
    const event = {
      id: "legacy-event",
      assetId: asset.id,
      type: "Inspection",
    } as AssetEvent;

    await importLegacyAssets([asset], [event]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/assets/import");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      assets: [asset],
      events: [event],
    });
  });
});
