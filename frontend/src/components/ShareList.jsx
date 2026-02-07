import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup,
    IconButton, LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText, Typography,
} from '@mui/material';
import {Link} from "react-router-dom";

import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import CancelIcon from '@mui/icons-material/Cancel';
import LinkIcon from '@mui/icons-material/Link';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import RequestFileIcon from "../icons/RequestFileIcon";
import {DateTime} from "luxon";
import {useDispatch, useSelector} from "react-redux";
import {loadingState} from "../redux/util";
import {cancelUpload} from "../redux/upload/upload.slice";
import prettyBytes from "pretty-bytes";
import {deleteShare, fetchShares} from "../redux/share/share.action";
import {selectShareError, selectShares, selectShareState} from "../redux/share/share.selector";
import {isUpload, selectUploadProgress, selectUploadSpeed} from "../redux/upload/upload.select";

import Tooltip from '@mui/material/Tooltip';

const STATS_RANGE = {
    days7: "7d",
    days30: "30d",
    year1: "1y",
    all: "all",
};

function formatCompactNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    const abs = Math.abs(n);
    if (abs < 1000) return `${n}`;

    const units = ["k", "M", "B", "T"];
    let unitIndex = -1;
    let scaled = abs;
    while (scaled >= 1000 && unitIndex < units.length - 1) {
        scaled /= 1000;
        unitIndex += 1;
    }

    const decimals = scaled < 10 ? 1 : 0;
    const fixed = scaled.toFixed(decimals);
    const pretty = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
    const sign = n < 0 ? "-" : "";
    return `${sign}${pretty}${units[unitIndex]}`;
}

function sumClicks(clicks) {
    if (!clicks) return 0;
    return Object.values(clicks).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function getRangeWindow(range, createdIso, clicks) {
    // Click stats are keyed by day in UTC (YYYY-MM-DD). Keep all range math in UTC
    // so we don't drop the first/last day around local midnight.
    const end = DateTime.utc().startOf("day");

    if (range === STATS_RANGE.days7) {
        return { start: end.minus({ days: 6 }), end };
    }

    if (range === STATS_RANGE.days30) {
        return { start: end.minus({ days: 29 }), end };
    }

    if (range === STATS_RANGE.year1) {
        return { start: end.minus({ days: 364 }), end };
    }

    // all time
    const created = createdIso ? DateTime.fromISO(createdIso, {setZone: true}).toUTC().startOf("day") : null;
    const earliestClickKey = clicks ? Object.keys(clicks).sort()[0] : null;
    const earliestClick = earliestClickKey ? DateTime.fromISO(earliestClickKey, {zone: 'utc'}).startOf("day") : null;
    const start = (created && earliestClick)
        ? (created < earliestClick ? created : earliestClick)
        : (created || earliestClick || end.minus({ days: 29 }));

    return { start, end };
}

function buildDailySeries(clicks, start, end, createdIso) {
    const created = createdIso ? DateTime.fromISO(createdIso, {setZone: true}).toUTC().startOf("day") : null;
    const days = Math.max(0, Math.floor(end.diff(start, "days").days)) + 1;
    const series = new Array(days);

    for (let i = 0; i < days; i += 1) {
        const date = start.plus({ days: i });
        const key = date.toISODate();

        if (created && date < created) {
            series[i] = {
                value: null,
                label: key,
            };
            continue;
        }

        const raw = (clicks && clicks[key]) ? Number(clicks[key]) : 0;
        series[i] = {
            value: Number.isFinite(raw) ? raw : 0,
            label: key,
        };
    }

    return series;
}

function bucketSeries(series, start, end, bucketCount) {
    if (series.length <= bucketCount) return series;

    const result = new Array(bucketCount);
    for (let i = 0; i < bucketCount; i += 1) {
        const from = Math.floor((i * series.length) / bucketCount);
        const to = Math.floor(((i + 1) * series.length) / bucketCount);

        const bucketStart = start.plus({ days: from });
        const bucketEnd = start.plus({ days: Math.max(from, to - 1) });
        const label = bucketStart.toISODate() === bucketEnd.toISODate()
            ? bucketStart.toISODate()
            : `${bucketStart.toISODate()} - ${bucketEnd.toISODate()}`;

        let sum = 0;
        let hasExistingDay = false;
        for (let j = from; j < to; j += 1) {
            const v = series[j].value;
            if (v === null) continue;
            hasExistingDay = true;
            sum += v;
        }

        result[i] = {
            value: hasExistingDay ? sum : null,
            label,
        };
    }

    return result;
}

function StatsBarChart({series}) {
    const height = 64;

    const existingValues = series
        .filter((d) => d.value !== null)
        .map((d) => Number(d.value) || 0);
    const hasExistingDay = existingValues.length > 0;
    const max = hasExistingDay ? Math.max(1, ...existingValues) : 1;

    return (
        <Box
            sx={{
                height: `${height}px`,
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                px: "6px",
                py: "6px",
                borderRadius: "6px",
                backgroundColor: "action.hover",
            }}
        >
            {!hasExistingDay ? (
                <Box sx={{width: "100%", textAlign: "center", alignSelf: "center", opacity: 0.8}}>
                    <Typography variant="caption" component="div">
                        Share not created yet
                    </Typography>
                </Box>
            ) : (
                series.map((d, i) => {
                    const key = `${d.label}-${i}`;
                    if (d.value === null) {
                        // Do not draw bars for dates before share existed.
                        return <Box key={key} sx={{flex: 1, height: "100%"}} />;
                    }

                    const value = Number(d.value) || 0;
                    const scaled = Math.round((value / max) * (height - 12));
                    const barH = Math.max(2, scaled);
                    const isZero = value === 0;

                    return (
                        <Tooltip
                            key={key}
                            title={`${d.label}: ${value} clicks`}
                            arrow
                            placement="bottom"
                            followCursor
                            enterDelay={0}
                            componentsProps={{
                                popper: {
                                    sx: {
                                        zIndex: 2000,
                                    },
                                },
                            }}
                            PopperProps={{
                                disablePortal: true,
                            }}
                        >
                            <Box
                                sx={{
                                    flex: 1,
                                    height: `${barH}px`,
                                    borderRadius: "2px",
                                    backgroundColor: "currentColor",
                                    opacity: isZero ? 0.25 : 0.9,
                                    cursor: "default",
                                }}
                            />
                        </Tooltip>
                    );
                })
            )}
        </Box>
    );
}

function StatsTooltipContent({range, onRangeChange, clicks, created}) {
    const {start, end} = useMemo(() => getRangeWindow(range, created, clicks), [range, created, clicks]);
    const dailySeries = useMemo(() => buildDailySeries(clicks, start, end, created), [clicks, start, end, created]);
    const rangeTotal = useMemo(() => dailySeries.reduce((acc, d) => acc + (d.value || 0), 0), [dailySeries]);

    // Keep tooltip/chart size stable across ranges
    const chartSeries = useMemo(() => bucketSeries(dailySeries, start, end, 30), [dailySeries, start, end]);

    return (
        <Box
            sx={{
                width: 340,
                padding: "10px 12px",
                color: "text.primary",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px"}}>
                <Typography variant="subtitle2" component="div">
                    Clicks
                </Typography>
                <Typography variant="caption" component="div" sx={{opacity: 0.8}}>
                    {start.toISODate()} - {end.toISODate()}
                </Typography>
            </Box>

            <Box sx={{mt: 1, mb: 1, color: "primary.main"}}>
                <StatsBarChart series={chartSeries} />
            </Box>

            <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px"}}>
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={range}
                    onChange={(_, v) => { if (v) onRangeChange(v); }}
                >
                    <ToggleButton value={STATS_RANGE.days7}>7d</ToggleButton>
                    <ToggleButton value={STATS_RANGE.days30}>30d</ToggleButton>
                    <ToggleButton value={STATS_RANGE.year1}>1y</ToggleButton>
                    <ToggleButton value={STATS_RANGE.all}>All</ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="caption" component="div" sx={{opacity: 0.85, whiteSpace: "nowrap"}}>
                    Total: {formatCompactNumber(rangeTotal)}
                </Typography>
            </Box>
        </Box>
    );
}

export function ShareUploadProgress(props) {
    const id = props.id;
    const progress = useSelector((s) => selectUploadProgress(s, id));
    const speed = useSelector((s) => selectUploadSpeed(s, id));

    return (
        <>
            <Typography
                component={"div"}
                variant={"caption"}
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    textAlign: "center",
                    gap: "0.5em"
                }}
            >
                <div>Upload in progress...</div>
                <div>{prettyBytes(speed)}/s</div>
            </Typography>
            <LinearProgress variant="determinate" value={progress*100} sx={{my:1}} />
        </>
    );
}

function ShareEntry(props) {
    const dispatch = useDispatch();

    const statsCloseTimeout = useRef(null);
    const [statsOpen, setStatsOpen] = useState(false);

    const upload = useSelector((s) => isUpload(s,props.id));

    const targetURL = window.location.protocol + '//' + window.location.host + (props.type === 'FILE_REQUEST' ? '/r/' : '/d/') + props.id;
    const created = useMemo(() => DateTime.fromISO(props.created).toLocaleString(DateTime.DATETIME_SHORT), [props.created]);
    const expires = useMemo(() => DateTime.fromISO(props.expire).toLocaleString(DateTime.DATETIME_SHORT), [props.expire]);

    const copyURL = () => {
        navigator.clipboard.writeText(targetURL).then();
    };

    const abortUpload = () => {
        dispatch(cancelUpload(props.id))
    };

    const cancelStatsClose = () => {
        if (statsCloseTimeout.current) {
            clearTimeout(statsCloseTimeout.current);
            statsCloseTimeout.current = null;
        }
    };

    const openStatsTooltip = () => {
        cancelStatsClose();
        setStatsOpen(true);
    };

    const scheduleCloseStatsTooltip = () => {
        cancelStatsClose();
        statsCloseTimeout.current = setTimeout(() => {
            setStatsOpen(false);
        }, 120);
    };

    const allTimeClicks = useMemo(() => sumClicks(props.clicks), [props.clicks]);

    const statsButtonWidth = {xs: '96px', sm: '104px'};
    const statsButtonSpacer = (
        <Box
            sx={{
                mr: 1,
                width: statsButtonWidth,
                height: '30px',
                display: {xs: 'none', sm: 'block'},
            }}
        />
    );

    const statsButton = (props.type !== "FILE_REQUEST") ? (
        <Box sx={{display: {xs: 'none', sm: 'inline-flex'}}}>
            <Tooltip
                arrow
                open={statsOpen}
                disableHoverListener
                disableFocusListener
                disableTouchListener
                enterTouchDelay={0}
                componentsProps={{
                    tooltip: {
                        sx: {
                            backgroundColor: "background.paper",
                            color: "text.primary",
                            boxShadow: 3,
                            padding: 0,
                            maxWidth: "none",
                        },
                    },
                    arrow: {
                        sx: {
                            color: "background.paper",
                        },
                    },
                }}
                title={(
                    <Box onMouseEnter={openStatsTooltip} onMouseLeave={scheduleCloseStatsTooltip}>
                        <StatsTooltipContent
                            range={props.statsRange}
                            onRangeChange={props.setStatsRange}
                            clicks={props.clicks}
                            created={props.created}
                        />
                    </Box>
                )}
            >
                <span onMouseEnter={openStatsTooltip} onMouseLeave={scheduleCloseStatsTooltip}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ShowChartIcon fontSize="small" />}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            mr: 1,
                            minWidth: 0,
                            width: statsButtonWidth,
                            paddingLeft: "10px",
                            paddingRight: "10px",
                            textTransform: "none",
                            lineHeight: 1.2,
                        }}
                    >
                        {formatCompactNumber(allTimeClicks)}
                    </Button>
                </span>
            </Tooltip>
        </Box>
    ) : statsButtonSpacer;

    let buttons;
    let center;
    if(upload) {
        buttons = <>
            <IconButton onClick={abortUpload} size="large">
                <CancelIcon color={"error"} />
            </IconButton>
        </>;
        center = <ShareUploadProgress id={props.id} />;
    } else if (props.uploadError) {
        buttons = <></>
        center = <Alert variant="filled" severity="error">An Error occurred while uploading</Alert>
    } else {
        buttons = <>
            {statsButton}
            <IconButton onClick={copyURL} size="large">
                <FileCopyIcon />
            </IconButton>
            <IconButton onClick={props.delete} size="large">
                <DeleteIcon color={"error"} />
            </IconButton>
        </>
        center = <>
            <div>{targetURL}</div>
            <Typography
                component={"div"}
                variant={"caption"}
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingRight: "1em",
                    textAlign: "center",
                    gap: "0.5em"
                }}
            >
                <div>
                    Created: {created}
                </div>
                <div>
                    Expires: {expires}
                </div>
            </Typography>
        </>
    }

    return (
        <ListItem sx={{alignItems: 'center'}}>
            <ListItemIcon>
                {props.type === 'FILE' && <AttachFileIcon />}
                {props.type === 'LINK' && <LinkIcon />}
                {props.type === 'FILE_REQUEST' && <RequestFileIcon />}
            </ListItemIcon>
            <Box sx={{display: 'flex', flex: 1, minWidth: 0, gap: '8px'}}>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <ListItemText
                        secondaryTypographyProps={{component: 'div'}}
                        secondary={center}
                        onClick={!upload ? (() => window.location.href = targetURL) : undefined}
                        sx={{
                            '& .MuiListItemText-secondary': {
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                cursor: !upload && 'pointer'
                            },
                            '& .MuiListItemText-primary': {
                                wordBreak: 'break-all'
                            }
                        }}
                    >
                        {props.title}
                    </ListItemText>
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flexShrink: 0,
                        flexWrap: {xs: 'wrap', sm: 'nowrap'},
                        rowGap: '6px',
                    }}
                >
                    {buttons}
                </Box>
            </Box>
        </ListItem>
    );
}

function ShareList() {
    const dispatch = useDispatch();
    const shares = useSelector(selectShares).filter(share => !share.deleting);
    const shareState = useSelector(selectShareState);
    const loading = (shareState === loadingState.pending);
    const error = (shareState === loadingState.failed);
    const errorMessage = useSelector(selectShareError);

    const [statsRange, setStatsRange] = useState(STATS_RANGE.days30);

    useEffect(() => {
        if(shareState === loadingState.idle) {
            dispatch(fetchShares());
        }
    }, [shareState, dispatch]);

    return (
        <Card>
            <CardHeader title={'Shares'} action={<IconButton to={'/add'} component={Link} size="large"><AddIcon /></IconButton>} />
            <CardContent style={{textAlign: 'center'}}>
                { loading ? <CircularProgress /> :
                    (error ? <span>{errorMessage}</span> :
                        <List>
                            {shares.map(props => (
                                <ShareEntry key={props.id}
                                            statsRange={statsRange}
                                            setStatsRange={setStatsRange}
                                            delete={() => dispatch(deleteShare(props.id))} {...props} />
                            ))}
                            {shares.length === 0 &&
                                <ListItem>
                                    <ListItemText style={{textAlign: 'center'}}>Currently there are no active
                                        shares</ListItemText>
                                </ListItem>
                            }
                        </List>
                    )
                }
            </CardContent>
        </Card>
    );
}

export default ShareList;
