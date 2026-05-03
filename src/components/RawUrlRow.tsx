import { useState, useCallback } from "react";
import { Stack, Typography, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useSnackbar } from "notistack";

interface RawUrlRowProps {
  url: string;
}

export default function RawUrlRow({ url }: RawUrlRowProps) {
  const [copied, setCopied] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      enqueueSnackbar("Raw URL copied", { variant: "info" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      enqueueSnackbar("Failed to copy", { variant: "error" });
    }
  }, [url, enqueueSnackbar]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        bgcolor: "surfaceContainer.main",
        borderRadius: 1,
        px: 2,
        py: 1,
        gap: 1,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "text.primary",
        }}
      >
        {url}
      </Typography>
      <Tooltip title="Copy raw URL">
        <IconButton size="small" onClick={handleCopy} sx={{ color: "text.secondary" }}>
          {copied ? (
            <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
