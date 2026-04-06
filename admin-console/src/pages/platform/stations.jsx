import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { stationCatalog } from 'data/sinoport';

export default function PlatformStationsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Provisioning"
          title="货站管理"
          description="平台方在这里创建不同机场货站、分配默认角色和服务范围，并从平台后台直接进入对应货站系统。"
          chips={['Station Directory', 'Tenant Provisioning', 'Scope Control']}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="货站台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>货站编码</TableCell>
                <TableCell>区域</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationCatalog.map((station) => (
                <TableRow key={station.code} hover>
                  <TableCell>
                    <Stack>
                      <Typography variant="subtitle2">{station.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {station.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{station.region}</TableCell>
                  <TableCell>
                    <StatusChip label={station.control} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={station.phase} />
                  </TableCell>
                  <TableCell>{station.owner}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/dashboard" size="small" variant="outlined">
                      进入货站系统
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="新增货站" subheader="按 PRD 预留平台侧创建货站的基础字段">
          <Stack sx={{ gap: 2 }}>
            <TextField label="货站名称" value="RZE 东欧入口站" />
            <TextField label="货站编码" value="RZE" />
            <TextField label="机场代码" value="RZE / EPRZ" />
            <TextField select label="控制层级" value="协同控制">
              <MenuItem value="强控制">强控制</MenuItem>
              <MenuItem value="协同控制">协同控制</MenuItem>
              <MenuItem value="接口可视">接口可视</MenuItem>
            </TextField>
            <TextField label="服务范围" value="进港 handling / 卡车协同 / NOA / POD" multiline minRows={3} />
            <TextField label="默认 Owner" value="Expansion Team" />
            <Button variant="contained">创建站点租户</Button>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
