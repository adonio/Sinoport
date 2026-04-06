import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: '24px 16px 0px', mt: 'auto' }}
    >
      <Typography variant="caption">&copy; 2026 Sinoport OS Admin Console</Typography>
      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          Platform Governance
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Station Operations
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Promise-Driven Fulfillment
        </Typography>
      </Stack>
    </Stack>
  );
}
