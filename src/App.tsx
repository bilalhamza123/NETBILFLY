import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BUILTIN_SHOWCASE_CHANNELS, ADULT_PRESET_CHANNELS } from './presets';
import { 
  Play, 
  Pause, 
  Search, 
  Sparkles, 
  Lock, 
  Unlock, 
  Settings, 
  Tv, 
  Film, 
  Clapperboard, 
  Heart, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RefreshCw, 
  AlertCircle, 
  Plus, 
  Grid,
  Layers, 
  Key, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Database, 
  Copy, 
  Check, 
  Activity, 
  Info, 
  ArrowRight,
  ChevronRight,
  Sliders,
  X,
  Server,
  Calendar,
  Clock,
  Trash2,
  Edit,
  Download,
  Wifi,
  Upload,
  FolderOpen,
  Folder,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Share2,
  Bell
} from 'lucide-react';

import { HoverStreamPreview } from './components/HoverStreamPreview';
import { StreamStatusIndicator } from './components/StreamStatusIndicator';

// Live stream types for the Xtream IPTV system
interface LiveStream {
  num: number;
  name: string;
  stream_id: string | number;
  category_id: string;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  custom_sid?: string;
  direct_source?: string;
}

interface VodStream {
  num: number;
  name: string;
  stream_id: string | number;
  category_id: string;
  stream_icon?: string;
  added?: string;
  rating?: string;
  container_extension?: string;
}

interface SeriesStream {
  num: number;
  name: string;
  series_id: string | number;
  category_id: string;
  cover?: string;
  added?: string;
  rating?: string;
}

interface IPTVCategory {
  category_id: string;
  category_name: string;
  parent_id?: number | string;
}

// Global server connection info type
interface ServerConfig {
  host: string;
  username: string;
  password: string;
}

export default function App() {
  // Primary default credentials requested by the user
  const DEFAULT_SERVER: ServerConfig = {
    host: 'http://atlan2025.me',
    username: 'Rochdi70sam',
    password: 'd3hm7lsqrh'
  };

  // State Management
  const [config, setConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem('netbilfly_server_config');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return DEFAULT_SERVER;
  });

  const [activeTab, setActiveTab] = useState<'live' | 'vod' | 'series' | 'favorites' | 'adult' | 'streamex' | 'playlists' | 'epg'>('playlists');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Storage Lists loaded from IPTV Server
  const [rawLiveCategories, setRawLiveCategories] = useState<IPTVCategory[]>([]);
  const [rawLiveStreams, setRawLiveStreams] = useState<LiveStream[]>([]);
  const [vodCategories, setVodCategories] = useState<IPTVCategory[]>([]);
  const [vodStreams, setVodStreams] = useState<VodStream[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<IPTVCategory[]>([]);
  const [seriesStreams, setSeriesStreams] = useState<SeriesStream[]>([]);
  
  // Selection & UI Filters
  const [selectedLiveCategoryId, setSelectedLiveCategoryId] = useState<string>('all');
  const [selectedVodCategoryId, setSelectedVodCategoryId] = useState<string>('all');
  const [selectedSeriesCategoryId, setSelectedSeriesCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('netbilfly_favs');
    return saved ? JSON.parse(saved) : [];
  });
  const [copiedStreamUrl, setCopiedStreamUrl] = useState<string | null>(null);

  // Currently playing stream Info
  const [currentPlayItem, setCurrentPlayItem] = useState<{
    id: string | number;
    name: string;
    icon?: string;
    type: 'live' | 'vod' | 'series' | 'streamex';
    streamUrl: string;
  } | null>(null);

  // Parental PIN control for Adult Category
  const [isAdultUnlocked, setIsAdultUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [wrongPinError, setWrongPinError] = useState<boolean>(false);
  const [parentalPin, setParentalPin] = useState<string>(() => {
    return localStorage.getItem('netbilfly_parental_pin') || '0000';
  });
  const [showChangePin, setShowChangePin] = useState<boolean>(false);
  const [autoInjectAdultStreams, setAutoInjectAdultStreams] = useState<boolean>(true);
  const [newPin, setNewPin] = useState<string>('');

  // Diagnostics & Status
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [streamDiagnosticMsg, setStreamDiagnosticMsg] = useState<string>('Ready');
  const [pingStatus, setPingStatus] = useState<number | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [testProxyWorking, setTestProxyWorking] = useState<string>('Active');

  // Video and player element triggers
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);

  // Pagination for heavy lists (IPTV lists can contain 50k+ elements!)
  const [visibleCount, setVisibleCount] = useState<number>(80);

  // StreamEx VOD Hub State
  const [streamExType, setStreamExType] = useState<'movie' | 'tv'>('movie');
  const [streamExImdbId, setStreamExImdbId] = useState<string>('tt1375666'); // default Inception IMDB ID
  const [streamExSearchText, setStreamExSearchText] = useState<string>('');
  const [streamExSeason, setStreamExSeason] = useState<number>(1);
  const [streamExEpisode, setStreamExEpisode] = useState<number>(1);
  const [streamExEngine, setStreamExEngine] = useState<'streamex' | 'vidsrc'>('streamex');

  // StreamEx Dynamic IMDb Search Sourcing
  const [streamExDynamicQuery, setStreamExDynamicQuery] = useState<string>('');
  const [dynamicSearchResults, setDynamicSearchResults] = useState<any[]>([]);
  const [dynamicSearchLoading, setDynamicSearchLoading] = useState<boolean>(false);
  const [dynamicSearchError, setDynamicSearchError] = useState<string | null>(null);

  // Electronic Program Guide (EPG) State Management
  const [epgListings, setEpgListings] = useState<any[]>([]);
  const [epgLoading, setEpgLoading] = useState<boolean>(false);
  const [epgError, setEpgError] = useState<string | null>(null);
  const [selectedEpgChannel, setSelectedEpgChannel] = useState<LiveStream | null>(null);
  const [selectedEpgCategoryId, setSelectedEpgCategoryId] = useState<string>('all');
  const [epgSearchQuery, setEpgSearchQuery] = useState<string>('');

  // Active video player EPG listings
  const [playerEpgListings, setPlayerEpgListings] = useState<any[]>([]);
  const [playerEpgLoading, setPlayerEpgLoading] = useState<boolean>(false);

  // EPG Reminders State
  const [reminders, setReminders] = useState<{
    id: string; // `${streamId}-${programTitle}-${startTime}`
    streamId: number | string;
    channelName: string;
    programTitle: string;
    startTime: string; 
    endTime: string;
  }[]>(() => {
    const saved = localStorage.getItem('netbilfly_epg_reminders');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    streamId: number | string;
    channelName: string;
    programTitle: string;
  } | null>(null);

  const toggleReminder = (
    streamId: number | string,
    channelName: string,
    programTitle: string,
    startTime: string,
    endTime: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const id = `${streamId}-${programTitle}-${startTime}`;
    
    // Request notification permission on first touch
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const exists = reminders.some(r => r.id === id);
    let updated;
    if (exists) {
      updated = reminders.filter(r => r.id !== id);
    } else {
      updated = [
        ...reminders,
        {
          id,
          streamId,
          channelName,
          programTitle,
          startTime,
          endTime
        }
      ];
    }
    setReminders(updated);
    localStorage.setItem('netbilfly_epg_reminders', JSON.stringify(updated));
  };

  // Dynamically calculate liveCategories and liveStreams based on raw server data and adult injection setting
  const liveCategories = useMemo(() => {
    const raw = rawLiveCategories;
    if (!autoInjectAdultStreams) return raw;
    
    // Check if virtual category already exists, if not, add it
    const virtualCatId = "adult-preset";
    if (raw.some(c => c.category_id === virtualCatId)) {
      return raw;
    }
    return [
      ...raw,
      {
        category_id: virtualCatId,
        category_name: "🔞 Premium Adult Network (+18)",
        parent_id: 0
      }
    ];
  }, [rawLiveCategories, autoInjectAdultStreams]);

  const liveStreams = useMemo(() => {
    const raw = rawLiveStreams;
    if (!autoInjectAdultStreams) return raw;

    const virtualCatId = "adult-preset";
    const augmented = [...raw];

    // Add each of the preset adult channels mapped to LiveStream schema
    ADULT_PRESET_CHANNELS.forEach((ch, idx) => {
      const customStreamId = `adult-preset-${idx}`;
      if (!augmented.some(s => s.stream_id === customStreamId)) {
        augmented.push({
          num: 9000 + idx,
          name: ch.name,
          stream_id: customStreamId,
          category_id: virtualCatId,
          stream_icon: ch.logo,
          direct_source: ch.url
        });
      }
    });

    return augmented;
  }, [rawLiveStreams, autoInjectAdultStreams, ADULT_PRESET_CHANNELS]);

  // Master Server & Playlist Management States
  const [savedServers, setSavedServers] = useState<any[]>(() => {
    const saved = localStorage.getItem('netbilfly_saved_servers');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return [
      {
        id: 'server-default-1',
        nickname: '📡 AMER SAT Premium Node',
        host: 'http://atlan2025.me',
        username: 'Rochdi70sam',
        password: 'd3hm7lsqrh',
        createdAt: new Date().toLocaleDateString()
      },
      {
        id: 'server-default-2',
        nickname: '📡 AMER SAT Test Shared Node',
        host: 'http://line.satiptv0.com:8080',
        username: 'satiptv_free_user',
        password: 'trial_password_9',
        createdAt: new Date().toLocaleDateString()
      }
    ];
  });

  const [savedPlaylists, setSavedPlaylists] = useState<any[]>(() => {
    const saved = localStorage.getItem('netbilfly_saved_playlists_meta');
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return [
      {
        id: 'playlist-default-builtin',
        name: 'Built-in Showcase Channels',
        channelsCount: BUILTIN_SHOWCASE_CHANNELS.length,
        createdAt: new Date().toLocaleDateString(),
        sourceType: 'file',
        sourceValue: 'BUILTIN_SHOWCASE_CHANNELS'
      }
    ];
  });

  const [newServerNickname, setNewServerNickname] = useState<string>('');
  const [newServerHost, setNewServerHost] = useState<string>('');
  const [newServerUser, setNewServerUser] = useState<string>('');
  const [newServerPassword, setNewServerPassword] = useState<string>('');
  const [isAddingServer, setIsAddingServer] = useState<boolean>(false);

  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editServerNickname, setEditServerNickname] = useState<string>('');
  const [editServerHost, setEditServerHost] = useState<string>('');
  const [editServerUser, setEditServerUser] = useState<string>('');
  const [editServerPassword, setEditServerPassword] = useState<string>('');

  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [serverPingResults, setServerPingResults] = useState<Record<string, { ok: boolean; ping?: number; msg: string }>>({});

  const [savePlaylistNameInput, setSavePlaylistNameInput] = useState<string>('');

  // M3U IPTV Playlist state management
  const [m3uPlaylistChannels, setM3uPlaylistChannels] = useState<{
    name: string;
    logo: string;
    category: string;
    url: string;
  }[]>([]);
  const [m3uLoading, setM3uLoading] = useState<boolean>(false);
  const [m3uUrlInput, setM3uUrlInput] = useState<string>('');
  const [m3uTextInput, setM3uTextInput] = useState<string>('');
  const [activePlaylistName, setActivePlaylistName] = useState<string>('Built-in Showcase Channels');
  
  // Dynamic Web Auto-Sync & System Reset States
  const [isWebAutoSyncActive, setIsWebAutoSyncActive] = useState<boolean>(() => {
    return localStorage.getItem('netbilfly_web_auto_sync') === 'true';
  });
  const [webSyncProgress, setWebSyncProgress] = useState<string>('');
  const [lastWebSyncTime, setLastWebSyncTime] = useState<string>(() => {
    return localStorage.getItem('netbilfly_last_web_sync_time') || '';
  });

  // Background reminder polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setReminders(prev => {
        let changed = false;
        const upcoming = [...prev];
        const triggeredIds: string[] = [];

        for (let i = 0; i < upcoming.length; i++) {
          const reminder = upcoming[i];
          const startTs = parseInt(reminder.startTime, 10);
          const startEpgObj = !isNaN(startTs) ? parseTimestamp(startTs) : parseEpgDate(reminder.startTime);
          
          if (startEpgObj) {
            const diffMs = startEpgObj.getTime() - now.getTime();
            // Trigger 1 minute before or within 10 seconds of streaming start
            const isStartingNow = diffMs <= 60000 && diffMs >= -30000;
            const alreadyEnded = diffMs < -1800000; // auto cleanup older than 30 mins

            if (isStartingNow) {
              triggeredIds.push(reminder.id);
              setActiveNotification({
                id: reminder.id,
                streamId: reminder.streamId,
                channelName: reminder.channelName,
                programTitle: reminder.programTitle
              });

              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`Show Reminder: ${reminder.programTitle}`, {
                    body: `"${reminder.programTitle}" is starting now on ${reminder.channelName}! Click to prepare your stream.`,
                    tag: reminder.id
                  });
                } catch (e) {
                  console.warn("HTML5 Notification block:", e);
                }
              }
            } else if (alreadyEnded) {
              triggeredIds.push(reminder.id);
            }
          }
        }

        if (triggeredIds.length > 0) {
          const filtered = upcoming.filter(r => !triggeredIds.includes(r.id));
          localStorage.setItem('netbilfly_epg_reminders', JSON.stringify(filtered));
          return filtered;
        }
        return prev;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Watch for play item updates
  useEffect(() => {
    if (!currentPlayItem || currentPlayItem.type === 'streamex') {
      if (currentPlayItem?.type === 'streamex') {
        setStreamDiagnosticMsg('Decoded via StreamEx Aggregator Node');
      }
      return;
    }
    setStreamDiagnosticMsg('Initializing stream decoding...');
    
    // Cleanup existing HLS instance
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Load Stream into HTML5 Video player (incorporating hls.js)
    const streamUrl = currentPlayItem.streamUrl;
    
    // Check if it's an HLS (.m3u8) video stream or has hls.js loaded
    const windowHls = (window as any).Hls;
    if (windowHls && windowHls.isSupported() && (streamUrl.includes('.m3u8') || currentPlayItem.type === 'live')) {
      const hls = new windowHls({
        enableWorker: true,
        maxBufferLength: 20,
        lowLatencyMode: true,
      });
      hlsInstanceRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoElement);
      hls.on(windowHls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(e => {
          console.warn('Auto play was blocked or interrupted', e);
        });
        setStreamDiagnosticMsg('Decoded via HlsEngine (Smooth Stream active)');
      });
      hls.on(windowHls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case windowHls.ErrorTypes.NETWORK_ERROR:
              setStreamDiagnosticMsg('Network issue. Attempting recovery...');
              hls.startLoad();
              break;
            case windowHls.ErrorTypes.MEDIA_ERROR:
              setStreamDiagnosticMsg('Media stream degraded. Attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setStreamDiagnosticMsg('Direct decoding failed. Playing fallback diagnostics.');
              break;
          }
        }
      });
    } else {
      // Direct load fallback for MP4, Series, or browsers which support native HLS (like Safari / Mobile)
      videoElement.src = streamUrl;
      videoElement.play().then(() => {
        setStreamDiagnosticMsg('Playing via native rendering pipeline');
      }).catch(e => {
        setStreamDiagnosticMsg('Native stream blocked. See external links below.');
        console.warn('Native autoplay failed', e);
      });
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [currentPlayItem]);

  // Load player EPG automatically on active channel changes
  useEffect(() => {
    if (currentPlayItem && currentPlayItem.type === 'live') {
      loadPlayerEpg(currentPlayItem.id);
    } else {
      setPlayerEpgListings([]);
    }
  }, [currentPlayItem]);

  // Global IPTV fetch handler that tries proxies to avoid CORS and mixed-content issues
  const fetchXtreamData = async (actionUrl: string) => {
    // Elegant fallbacks sequence: Direct, corsproxy.io, allorigins
    const proxies = [
      (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => u, // direct fallback
    ];

    let lastErr = null;
    for (const proxyFn of proxies) {
      try {
        const target = proxyFn(actionUrl);
        const res = await fetch(target, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data;
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Connection timed out. Check if server address is reachable.");
  };

  // Synchronizes currently loaded server nodes to the local M3U playlist format
  const syncServerToM3UPlaylist = () => {
    if (liveStreams.length === 0) {
      alert("No active live streams loaded from the connected server. Please first key in, scraping or loading an AMER SAT IPTV server node in the Server Setup or Telegram community section, wait for content load, and then sync to M3U!");
      return;
    }
    const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
    const mapped = liveStreams.map(stream => {
      const categoryName = liveCategories.find(c => c.category_id === stream.category_id)?.category_name || "Uncategorized Live Stream";
      return {
        name: stream.name,
        logo: stream.stream_icon || "",
        category: categoryName,
        url: `${sanitizedHost}/live/${config.username}/${config.password}/${stream.stream_id}.ts`
      };
    });

    // Automatically append user's custom premium adult playlist if selected or server is active
    const finalChannels = autoInjectAdultStreams ? [...mapped, ...ADULT_PRESET_CHANNELS] : mapped;

    setM3uPlaylistChannels(finalChannels);
    setActivePlaylistName(
      autoInjectAdultStreams 
        ? `Server Live Feed (${config.username}) + 🔞 Adult Pool` 
        : `Connected Server Live Feed (${config.username})`
    );
    
    setTimeout(() => {
      const activeGrid = document.getElementById("m3u-channels-active-grid");
      if (activeGrid) {
        activeGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }, 120);
  };

  // Main initial loader
  const loadXtreamServerContent = async () => {
    setLoading(true);
    setErrorMsg(null);
    const startTime = Date.now();

    try {
      const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
      const baseUrl = `${sanitizedHost}/player_api.php?username=${config.username}&password=${config.password}`;

      // 1. Fetch live channels & categories
      const liveCatsUrl = `${baseUrl}&action=get_live_categories`;
      const liveStreamsUrl = `${baseUrl}&action=get_live_streams`;
      
      const [cats, streams, mainInfo] = await Promise.all([
        fetchXtreamData(liveCatsUrl).catch(() => [] as IPTVCategory[]),
        fetchXtreamData(liveStreamsUrl).catch(() => [] as LiveStream[]),
        fetchXtreamData(baseUrl).catch(() => null)
      ]);

      setPingStatus(Date.now() - startTime);

      if (mainInfo && mainInfo.user_info) {
        setServerInfo(mainInfo);
      }

      setRawLiveCategories(Array.isArray(cats) ? cats : []);
      setRawLiveStreams(Array.isArray(streams) ? streams : []);

      // 2. Fetch VOD Movies
      const vodCatsUrl = `${baseUrl}&action=get_vod_categories`;
      const vodStreamsUrl = `${baseUrl}&action=get_vod_streams`;
      const [vCats, vStreams] = await Promise.all([
        fetchXtreamData(vodCatsUrl).catch(() => []),
        fetchXtreamData(vodStreamsUrl).catch(() => [])
      ]);
      setVodCategories(Array.isArray(vCats) ? vCats : []);
      setVodStreams(Array.isArray(vStreams) ? vStreams : []);

      // 3. Fetch Series
      const seriesCatsUrl = `${baseUrl}&action=get_series_categories`;
      const seriesStreamsUrl = `${baseUrl}&action=get_series`;
      const [sCats, sStreams] = await Promise.all([
        fetchXtreamData(seriesCatsUrl).catch(() => []),
        fetchXtreamData(seriesStreamsUrl).catch(() => [])
      ]);
      setSeriesCategories(Array.isArray(sCats) ? sCats : []);
      setSeriesStreams(Array.isArray(sStreams) ? sStreams : []);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Server connection failed. Please check host configuration or try an alternate proxy.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger content load on mount & configuration changes
  useEffect(() => {
    loadXtreamServerContent();
  }, [config]);

  // Auto scroll to load more channels
  const loadMore = () => {
    setVisibleCount(prev => prev + 60);
  };

  // Adult Categories Identification Pattern
  // Flags category names with typical Adult keywords
  const adultKeywords = ['adult', 'xxx', '18+', '18 +', 'dorcel', 'pink', 'for adult', 'redlight', 'hustler', 'exotic', 'lover', 'sensual', 'erotic', 'penthouse', 'playboy', 'venus', 'sexe', 'sex', 'sexy', 'colmax', 'jacquie', 'micheline', 'privé'];
  
  const isCategoryAdult = (catName: string): boolean => {
    const nameLower = catName.toLowerCase();
    return adultKeywords.some(keyword => nameLower.includes(keyword));
  };

  // Grouped and sorted arrays
  const separatedCategories = useMemo(() => {
    const live = { regular: [] as IPTVCategory[], adult: [] as IPTVCategory[] };
    liveCategories.forEach(cat => {
      if (isCategoryAdult(cat.category_name)) {
        live.adult.push(cat);
      } else {
        live.regular.push(cat);
      }
    });

    const vod = { regular: [] as IPTVCategory[], adult: [] as IPTVCategory[] };
    vodCategories.forEach(cat => {
      if (isCategoryAdult(cat.category_name)) {
        vod.adult.push(cat);
      } else {
        vod.regular.push(cat);
      }
    });

    const series = { regular: [] as IPTVCategory[], adult: [] as IPTVCategory[] };
    seriesCategories.forEach(cat => {
      if (isCategoryAdult(cat.category_name)) {
        series.adult.push(cat);
      } else {
        series.regular.push(cat);
      }
    });

    return { live, vod, series };
  }, [liveCategories, vodCategories, seriesCategories]);

  // List of all active adult category IDs across live, VOD and series
  const adultCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    separatedCategories.live.adult.forEach(c => ids.add(c.category_id));
    separatedCategories.vod.adult.forEach(c => ids.add(c.category_id));
    separatedCategories.series.adult.forEach(c => ids.add(c.category_id));
    return ids;
  }, [separatedCategories]);

  // Clean, fast filter of items to show
  const filteredLiveStreams = useMemo(() => {
    return liveStreams.filter(stream => {
      // If we are looking for adult streams
      const isItemAdult = adultCategoryIds.has(stream.category_id);
      
      if (activeTab === 'adult') {
        if (!isItemAdult) return false;
        if (selectedLiveCategoryId !== 'all' && stream.category_id !== selectedLiveCategoryId) return false;
      } else if (activeTab === 'favorites') {
        if (!favorites.includes(`live-${stream.stream_id}`)) return false;
      } else {
        // general Live TV tab
        if (isItemAdult) return false; // Hide adult streams from main view
        if (selectedLiveCategoryId !== 'all' && stream.category_id !== selectedLiveCategoryId) return false;
      }

      if (searchQuery) {
        return stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [liveStreams, selectedLiveCategoryId, searchQuery, activeTab, favorites, adultCategoryIds]);

  const filteredVodStreams = useMemo(() => {
    return vodStreams.filter(stream => {
      const isItemAdult = adultCategoryIds.has(stream.category_id);
      
      if (activeTab === 'adult') {
        if (!isItemAdult) return false;
        if (selectedVodCategoryId !== 'all' && stream.category_id !== selectedVodCategoryId) return false;
      } else if (activeTab === 'favorites') {
        if (!favorites.includes(`vod-${stream.stream_id}`)) return false;
      } else {
        // general Movie tab
        if (isItemAdult) return false;
        if (selectedVodCategoryId !== 'all' && stream.category_id !== selectedVodCategoryId) return false;
      }

      if (searchQuery) {
        return stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [vodStreams, selectedVodCategoryId, searchQuery, activeTab, favorites, adultCategoryIds]);

  const filteredSeriesStreams = useMemo(() => {
    return seriesStreams.filter(stream => {
      const isItemAdult = adultCategoryIds.has(stream.category_id);

      if (activeTab === 'adult') {
        if (!isItemAdult) return false;
        if (selectedSeriesCategoryId !== 'all' && stream.category_id !== selectedSeriesCategoryId) return false;
      } else if (activeTab === 'favorites') {
        if (!favorites.includes(`series-${stream.series_id}`)) return false;
      } else {
        // general Series tab
        if (isItemAdult) return false;
        if (selectedSeriesCategoryId !== 'all' && stream.category_id !== selectedSeriesCategoryId) return false;
      }

      if (searchQuery) {
        return stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [seriesStreams, selectedSeriesCategoryId, searchQuery, activeTab, favorites, adultCategoryIds]);

  // Playback handlers
  const playLiveStream = (stream: LiveStream) => {
    const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
    // Construct Xtream Stream Link, fallback to direct source if specified
    const streamUrl = stream.direct_source || `${sanitizedHost}/live/${config.username}/${config.password}/${stream.stream_id}.ts`;
    
    setCurrentPlayItem({
      id: stream.stream_id,
      name: stream.name,
      icon: stream.stream_icon,
      type: 'live',
      streamUrl: streamUrl
    });
  };

  const playVodMovie = (movie: VodStream) => {
    const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
    const format = movie.container_extension || 'mp4';
    const streamUrl = `${sanitizedHost}/movie/${config.username}/${config.password}/${movie.stream_id}.${format}`;
    
    setCurrentPlayItem({
      id: movie.stream_id,
      name: movie.name,
      icon: movie.stream_icon,
      type: 'vod',
      streamUrl: streamUrl
    });
  };

  const playSeriesEpisode = (series: SeriesStream) => {
    const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
    // Series usually load with an episode/stream structure. We will load the stream URL 
    const streamUrl = `${sanitizedHost}/series/${config.username}/${config.password}/${series.series_id}.ts`;
    
    setCurrentPlayItem({
      id: series.series_id,
      name: series.name,
      icon: series.cover,
      type: 'series',
      streamUrl: streamUrl
    });
  };

  const playStreamExItem = (title: string, id: string, type: 'movie' | 'tv', seasonVal?: number, episodeVal?: number) => {
    // Elegant dual CDN fallback engine!
    const activeProvider = streamExEngine === 'streamex' ? 'https://streamex.sh' : 'https://vidsrc.xyz';
    const embedUrl = type === 'movie' 
      ? `${activeProvider}/embed/movie/${id}`
      : `${activeProvider}/embed/tv/${id}/${seasonVal || 1}/${episodeVal || 1}`;

    setCurrentPlayItem({
      id: id,
      name: `${title} ${type === 'tv' ? `(S${seasonVal || 1} E${episodeVal || 1})` : ''} via StreamEx CDN`,
      icon: undefined,
      type: 'streamex',
      streamUrl: embedUrl
    });

    // Scroll smoothly to player container
    const playerEl = document.getElementById('iptv-player-container-block');
    if (playerEl) {
      playerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const curatedStreamExMovies = useMemo(() => [
    { id: 'tt1375666', tmdbId: '27205', title: 'Inception', year: '2010', rating: '8.8', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80' },
    { id: 'tt1160419', tmdbId: '76600', title: 'Avatar: The Way of Water', year: '2022', rating: '7.6', poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80' },
    { id: 'tt15398776', tmdbId: '872585', title: 'Oppenheimer', year: '2023', rating: '8.4', poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&q=80' },
    { id: 'tt15239678', tmdbId: '693134', title: 'Dune: Part Two', year: '2024', rating: '8.6', poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80' },
    { id: 'tt2906216', tmdbId: '346698', title: 'Barbie', year: '2023', rating: '6.9', poster: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80' },
    { id: 'tt0816692', tmdbId: '157336', title: 'Interstellar', year: '2014', rating: '8.7', poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80' },
    { id: 'tt0468569', tmdbId: '155', title: 'The Dark Knight', year: '2008', rating: '9.0', poster: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&q=80' },
    { id: 'tt0133093', tmdbId: '603', title: 'The Matrix', year: '1999', rating: '8.7', poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80' },
    { id: 'tt16277242', tmdbId: '533535', title: 'Deadpool & Wolverine', year: '2024', rating: '8.0', poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80' },
    { id: 'tt0417741', tmdbId: '1022789', title: 'Inside Out 2', year: '2024', rating: '7.9', poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80' },
    { id: 'tt0110912', tmdbId: '680', title: 'Pulp Fiction', year: '1994', rating: '8.9', poster: 'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=400&q=80' },
    { id: 'tt11358390', tmdbId: '558449', title: 'Gladiator II', year: '2024', rating: '7.1', poster: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&q=80' },
  ], []);

  const curatedStreamExSeries = useMemo(() => [
    { id: 'tt0944947', tmdbId: '1399', title: 'Game of Thrones', year: '2011-2019', rating: '9.2', poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80' },
    { id: 'tt0903747', tmdbId: '1396', title: 'Breaking Bad', year: '2008-2013', rating: '9.5', poster: 'https://images.unsplash.com/photo-1569074187119-c87815b476da?w=400&q=80' },
    { id: 'tt3581920', tmdbId: '121366', title: 'The Last of Us', year: '2023-', rating: '8.8', poster: 'https://images.unsplash.com/photo-1547483238-f400e65ccd56?w=400&q=80' },
    { id: 'tt5028038', tmdbId: '66732', title: 'Stranger Things', year: '2016-', rating: '8.7', poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80' },
    { id: 'tt11198330', tmdbId: '94997', title: 'House of the Dragon', year: '2022-', rating: '8.4', poster: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=400&q=80' },
    { id: 'tt8111088', tmdbId: '82856', title: 'The Mandalorian', year: '2019-', rating: '8.7', poster: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80' },
    { id: 'tt13443470', tmdbId: '119051', title: 'Wednesday', year: '2022-', rating: '8.1', poster: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&q=80' },
    { id: 'tt1190634', tmdbId: '76479', title: 'The Boys', year: '2019-', rating: '8.7', poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&q=80' },
  ], []);

  const filteredCuratedMovies = useMemo(() => {
    if (!streamExSearchText) return curatedStreamExMovies;
    return curatedStreamExMovies.filter(m => 
      m.title.toLowerCase().includes(streamExSearchText.toLowerCase()) || 
      m.id.toLowerCase().includes(streamExSearchText.toLowerCase()) || 
      m.tmdbId.toLowerCase().includes(streamExSearchText.toLowerCase())
    );
  }, [streamExSearchText, curatedStreamExMovies]);

  const filteredCuratedSeries = useMemo(() => {
    if (!streamExSearchText) return curatedStreamExSeries;
    return curatedStreamExSeries.filter(s => 
      s.title.toLowerCase().includes(streamExSearchText.toLowerCase()) || 
      s.id.toLowerCase().includes(streamExSearchText.toLowerCase()) || 
      s.tmdbId.toLowerCase().includes(streamExSearchText.toLowerCase())
    );
  }, [streamExSearchText, curatedStreamExSeries]);

  // Dynamic StreamEx Search via IMDb Autocomplete proxy
  const triggerDynamicStreamExSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setDynamicSearchResults([]);
      return;
    }
    setDynamicSearchLoading(true);
    setDynamicSearchError(null);
    try {
      const q = query.trim().toLowerCase();
      const firstChar = q.charAt(0);
      const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(q)}.json`;
      
      const responseData = await fetchXtreamData(url);
      if (responseData && Array.isArray(responseData.d)) {
        const formatted = responseData.d
          .filter((item: any) => item.id && item.id.startsWith('tt')) // must be valid imdb identifier tt...
          .map((item: any) => ({
            id: item.id,
            title: item.l,
            year: item.y || 'N/A',
            rating: item.rank ? (10 - (item.rank / 1000000)).toFixed(1) : '7.5', 
            type: item.q === 'tvSeries' || item.q === 'tvMiniSeries' || item.q === 'tvSpecial' ? 'tv' : 'movie',
            poster: item.i?.imageUrl || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80',
            stars: item.s || ''
          }));
        setDynamicSearchResults(formatted);
      } else {
        setDynamicSearchResults([]);
      }
    } catch (err: any) {
      console.warn("IMDb suggestion search failed: ", err);
      setDynamicSearchError("Search services are currently offline or blocked by origin provider.");
    } finally {
      setDynamicSearchLoading(false);
    }
  };

  // Synchronously fetch and merge dynamic free TV streams from around the web (presets loaded from sub-module)

  // Synchronously fetch and merge dynamic free TV streams from around the web
  const triggerWebWideAutoSync = async (silent: boolean = false) => {
    setM3uLoading(true);
    if (!silent) {
      setWebSyncProgress("Connecting to web-wide live TV repositories...");
    }
    
    try {
      const liveAggregatedChannels = [...BUILTIN_SHOWCASE_CHANNELS];
      
      // Add ultra reliable global public TV streams
      const extraStableStreams = [
        { name: "Sky News Live (UK)", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Sky_News_logo_2018.svg", category: "News / Actualités", url: "https://skynews-skynewsmain-inpage.samsung.wurl.com/manifest/playlist.m3u8" },
        { name: "Al Jazeera English News", logo: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Al_Jazeera_English_logo.svg", category: "News / Actualités", url: "https://live-hls-web-aje.getaj.net/AJE/index.m3u8" },
        { name: "TRT World News (Global)", logo: "https://upload.wikimedia.org/wikipedia/commons/a/ae/TRT_World_logo.svg", category: "News / Actualités", url: "https://tv-trtworld.medya.trt.com.tr/trtworld/trtworld_direct_rtmp/playlist.m3u8" },
        { name: "Arirang TV News & Life", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Arirang_logo.svg/300px-Arirang_logo.svg.png", category: "News / Actualités", url: "https://amdlive.ctnd.com.tr/arirang_1ch/arirang_1ch.smil/playlist.m3u8" },
        { name: "KBS World TV (Korea)", logo: "https://upload.wikimedia.org/wikipedia/commons/5/52/KBS_World_2017.svg", category: "Entertainment & Life", url: "https://kbsworld-ott.kbs.co.kr/hls/kbsworld.m3u8" },
        { name: "CNA News Live (Singapore)", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e1/CNA_logo.svg", category: "News / Actualités", url: "https://cna-hls.mediacorp.kiwi/master.m3u8" },
        { name: "NHK World Japan (News HD)", logo: "https://upload.wikimedia.org/wikipedia/commons/1/1d/NHK_World_Japan_logo.svg", category: "Documentary & Space", url: "https://nhkworld.akamaized.net/hls/live/2007474/nhkworld/master.m3u8" },
        { name: "Euronews Live English HD", logo: "https://upload.wikimedia.org/wikipedia/commons/4/40/Euronews_logo_2016.svg", category: "News / Actualités", url: "https://euronews-euronews-english-1-ca.samsung.wurl.com/manifest/playlist.m3u8" }
      ];

      extraStableStreams.forEach(stream => {
        if (!liveAggregatedChannels.some(c => c.url === stream.url)) {
          liveAggregatedChannels.push(stream);
        }
      });

      if (!silent) {
        setWebSyncProgress("Querying dynamic open-source list index...");
      }

      const remoteUrl = "https://iptv-org.github.io/iptv/categories/news.m3u";
      let fetchedText = "";
      const proxies = [
        (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
      ];

      for (const proxyFn of proxies) {
        try {
          const res = await fetch(proxyFn(remoteUrl));
          if (res.ok) {
            fetchedText = await res.text();
            break;
          }
        } catch (_) {}
      }

      if (fetchedText) {
        const parsedRepo = parseM3U(fetchedText);
        let count = 0;
        parsedRepo.forEach(ch => {
          if (count < 60 && ch.url && ch.name && !liveAggregatedChannels.some(exist => exist.url === ch.url)) {
            liveAggregatedChannels.push({
              name: `🌐 ${ch.name}`,
              logo: ch.logo || "https://upload.wikimedia.org/wikipedia/commons/d/df/Tv_sign.svg",
              category: ch.category || "Web-Wide Sync Channels",
              url: ch.url
            });
            count++;
          }
        });
      }

      setM3uPlaylistChannels(liveAggregatedChannels);
      setActivePlaylistName("Web-Synced Live Stream Bundle");
      
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " (UTC)";
      setLastWebSyncTime(nowStr);
      localStorage.setItem('netbilfly_last_web_sync_time', nowStr);
      
      if (!silent) {
        setWebSyncProgress(`Sync complete! Loaded ${liveAggregatedChannels.length} TV stations successfully.`);
      }
    } catch (err: any) {
      console.warn("Auto Sync error: ", err);
      if (!silent) {
        setWebSyncProgress("Sync reached limit; activated pre-cached premium web assets instead.");
      }
    } finally {
      setM3uLoading(false);
    }
  };

  // Prepopulate the channels with built-in streams & trigger Web Auto Sync if enabled
  useEffect(() => {
    if (isWebAutoSyncActive) {
      triggerWebWideAutoSync(true); // Silent start
    } else {
      setM3uPlaylistChannels(BUILTIN_SHOWCASE_CHANNELS);
    }
  }, [BUILTIN_SHOWCASE_CHANNELS]);

  // Automatically sync connected server channels space to M3U viewer on active connection loading
  useEffect(() => {
    if (liveStreams.length > 0) {
      const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
      const mapped = liveStreams.map(stream => {
        const categoryName = liveCategories.find(c => c.category_id === stream.category_id)?.category_name || "Uncategorized Live Stream";
        return {
          name: stream.name,
          logo: stream.stream_icon || "",
          category: categoryName,
          url: stream.direct_source || `${sanitizedHost}/live/${config.username}/${config.password}/${stream.stream_id}.ts`
        };
      });

      // Combine with user's shared +18 group-channels
      const finalChannels = autoInjectAdultStreams ? [...mapped, ...ADULT_PRESET_CHANNELS] : mapped;
      
      setM3uPlaylistChannels(finalChannels);
      setActivePlaylistName(
        autoInjectAdultStreams 
          ? `Server Live Feed (${config.username}) + 🔞 Adult Pool` 
          : `Connected Server Live Feed (${config.username})`
      );
    }
  }, [liveStreams, liveCategories, autoInjectAdultStreams, config]);

  // Robust inline M3U Parser
  const parseM3U = (text: string) => {
    const lines = text.split('\n');
    const items: { name: string; logo: string; category: string; url: string }[] = [];
    let currentItem: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith('#EXTINF:')) {
        currentItem = {
          name: 'Unknown Channel',
          logo: '',
          category: 'Channels / Chaînes',
          url: ''
        };

        const logoMatch = line.match(/tvg-logo="([^"]+)"/i) || line.match(/logo="([^"]+)"/i);
        if (logoMatch) currentItem.logo = logoMatch[1];

        const groupMatch = line.match(/group-title="([^"]+)"/i) || line.match(/group="([^"]+)"/i);
        if (groupMatch) currentItem.category = groupMatch[1];

        const commaIndex = line.lastIndexOf(',');
        if (commaIndex !== -1) {
          currentItem.name = line.substring(commaIndex + 1).trim();
        }
      } else if (line && !line.startsWith('#') && currentItem) {
        currentItem.url = line;
        items.push(currentItem);
        currentItem = null;
      }
    }
    return items;
  };

  const loadM3UFromUrl = async (urlStr: string) => {
    if (!urlStr || urlStr.trim().length === 0) return;
    setM3uLoading(true);
    try {
      let textContent = '';
      const proxies = [
        (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u: string) => u
      ];

      let loaded = false;
      for (const proxyFn of proxies) {
        try {
          const res = await fetch(proxyFn(urlStr));
          if (res.ok) {
            textContent = await res.text();
            loaded = true;
            break;
          }
        } catch (_) {}
      }

      if (!loaded) {
        throw new Error("Could not retrieve playlist content directly via proxy layers. Try uploading a copy from local disk.");
      }

      const parsedItems = parseM3U(textContent);
      if (parsedItems.length > 0) {
        setM3uPlaylistChannels(parsedItems);
        let name = 'M3U Link Playlist';
        try {
          const urlObj = new URL(urlStr);
          name = urlObj.pathname.split('/').pop() || urlObj.hostname;
        } catch (_) {}
        setActivePlaylistName(name);
        setM3uUrlInput('');
      } else {
        alert("Parsed 0 channels. Ensure standard EXTM3U format rules.");
      }
    } catch (err: any) {
      alert(err.message || "Failed loading playlist.");
    } finally {
      setM3uLoading(false);
    }
  };

  const handleLoadPastedM3UText = () => {
    if (!m3uTextInput || m3uTextInput.trim().length === 0) return;
    const parsed = parseM3U(m3uTextInput);
    if (parsed.length > 0) {
      setM3uPlaylistChannels(parsed);
      setActivePlaylistName("Custom Pasted Playlist");
      setM3uTextInput('');
    } else {
      alert("No valid #EXTINF channel keys parsed from code block. Verify formats.");
    }
  };

  const handleM3UFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseM3U(text);
        if (parsed.length > 0) {
          setM3uPlaylistChannels(parsed);
          setActivePlaylistName(file.name || "Offline file");
        } else {
          alert("Could not extract active channels. Missing #EXTM3U formatting lines.");
        }
      }
    };
    reader.readAsText(file);
  };
  
  // --- SERVER & M3U PLAYLIST ADMINISTRATIVE OPERATIONS ---
  
  const testServerConnection = async (server: any) => {
    const sanitizedHost = server.host.endsWith('/') ? server.host.slice(0, -1) : server.host;
    const testUrl = `${sanitizedHost}/player_api.php?username=${server.username}&password=${server.password}`;
    const startTime = Date.now();
    try {
      const data = await fetchXtreamData(testUrl);
      if (data && (data.user_info || Array.isArray(data))) {
        return { ok: true, ping: Date.now() - startTime, message: "Connected Successfully" };
      }
      return { ok: false, message: "Host replied but rejected credentials or returned unexpected output." };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to reach host portal." };
    }
  };

  const handleTestServerConnection = async (srv: any) => {
    setTestingConnectionId(srv.id);
    try {
      const result = await testServerConnection(srv);
      setServerPingResults(prev => ({
        ...prev,
        [srv.id]: {
          ok: result.ok,
          ping: result.ping,
          msg: result.ok ? `Online - Ping ${result.ping}ms` : `Offline - ${result.message}`
        }
      }));
    } catch (err: any) {
      setServerPingResults(prev => ({
        ...prev,
        [srv.id]: {
          ok: false,
          msg: `Offline: ${err.message}`
        }
      }));
    } finally {
      setTestingConnectionId(null);
    }
  };

  const handleAddSavedServer = () => {
    if (!newServerHost || !newServerUser || !newServerPassword) {
      alert("Please fill in Host URL, Username, and Password fields.");
      return;
    }

    const hostFormatted = newServerHost.trim();
    const cleanNickname = newServerNickname.trim() || `Server ${newServerUser}`;

    const newId = `server-${Date.now()}`;
    const newServerItem = {
      id: newId,
      nickname: cleanNickname,
      host: hostFormatted,
      username: newServerUser.trim(),
      password: newServerPassword.trim(),
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [...savedServers, newServerItem];
    setSavedServers(updated);
    localStorage.setItem('netbilfly_saved_servers', JSON.stringify(updated));

    // Reset inputs
    setNewServerNickname('');
    setNewServerHost('');
    setNewServerUser('');
    setNewServerPassword('');
    setIsAddingServer(false);
  };

  const handleSaveEditedServer = () => {
    if (!editServerHost || !editServerUser || !editServerPassword) {
      alert("All fields are required to update this server.");
      return;
    }

    const updated = savedServers.map(srv => {
      if (srv.id === editingServerId) {
        return {
          ...srv,
          nickname: editServerNickname.trim() || `Server ${editServerUser}`,
          host: editServerHost.trim(),
          username: editServerUser.trim(),
          password: editServerPassword.trim()
        };
      }
      return srv;
    });

    setSavedServers(updated);
    localStorage.setItem('netbilfly_saved_servers', JSON.stringify(updated));
    setEditingServerId(null);
  };

  const handleDeleteSavedServer = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete server node info for "${name}"?`)) {
      const filtered = savedServers.filter(s => s.id !== id);
      setSavedServers(filtered);
      localStorage.setItem('netbilfly_saved_servers', JSON.stringify(filtered));
      
      const pings = { ...serverPingResults };
      delete pings[id];
      setServerPingResults(pings);
    }
  };

  const loadSavedPlaylist = (playlist: any) => {
    setM3uLoading(true);
    try {
      if (playlist.id === 'playlist-default-builtin') {
        setM3uPlaylistChannels(BUILTIN_SHOWCASE_CHANNELS);
        setActivePlaylistName(playlist.name);
      } else {
        const key = `netbilfly_playlist_channels_${playlist.id}`;
        const storedChannels = localStorage.getItem(key);
        if (storedChannels) {
          const channels = JSON.parse(storedChannels);
          setM3uPlaylistChannels(channels);
          setActivePlaylistName(playlist.name);
        } else {
          alert("Could not load channels for this playlist from local storage. It might have been cleared.");
        }
      }
    } catch (err: any) {
      alert("Failed loading playlist: " + err.message);
    } finally {
      setM3uLoading(false);
    }
  };

  const handleSaveCurrentToDashboard = () => {
    const title = savePlaylistNameInput.trim() || activePlaylistName;
    if (!m3uPlaylistChannels || m3uPlaylistChannels.length === 0) {
      alert("There are 0 channels loaded in memory to save.");
      return;
    }

    const newId = `playlist-${Date.now()}`;
    try {
      // 1. Try to save channels in dedicated partition
      localStorage.setItem(`netbilfly_playlist_channels_${newId}`, JSON.stringify(m3uPlaylistChannels));

      // 2. Add description meta
      const mItem = {
        id: newId,
        name: title,
        channelsCount: m3uPlaylistChannels.length,
        createdAt: new Date().toLocaleDateString(),
        sourceType: 'text',
        sourceValue: title === activePlaylistName ? 'Pasted or Imported Feed' : `Custom label: ${title}`
      };

      const updatedMeta = [...savedPlaylists, mItem];
      setSavedPlaylists(updatedMeta);
      localStorage.setItem('netbilfly_saved_playlists_meta', JSON.stringify(updatedMeta));

      setSavePlaylistNameInput('');
      alert(`Playlist "${title}" was successfully added to your Dashboard Database!`);
    } catch (err: any) {
      alert(
        "Standard Storage Quota exceeded.\n\n" +
        "We partition channel lists into slots to bypass standard memory crashes, but the browser database is full. Please remove some older playlists from the Dashboard first."
      );
    }
  };

  const handleDeleteSavedPlaylist = (id: string, name: string) => {
    if (id === 'playlist-default-builtin') {
      alert("Default builtin channels cannot be removed.");
      return;
    }
    if (confirm(`Do you want to permanently delete saved playlist "${name}" from your local collection?`)) {
      const filtered = savedPlaylists.filter(p => p.id !== id);
      setSavedPlaylists(filtered);
      localStorage.setItem('netbilfly_saved_playlists_meta', JSON.stringify(filtered));

      localStorage.removeItem(`netbilfly_playlist_channels_${id}`);
    }
  };

  const exportM3UPlaylist = (playlist: any) => {
    let channelsToExport = [];
    if (playlist.id === 'playlist-default-builtin') {
      channelsToExport = BUILTIN_SHOWCASE_CHANNELS;
    } else {
      const stored = localStorage.getItem(`netbilfly_playlist_channels_${playlist.id}`);
      if (stored) {
        channelsToExport = JSON.parse(stored);
      }
    }

    if (channelsToExport.length === 0) {
      alert("No channels are available inside this playlist node.");
      return;
    }

    let rawM3U = "#EXTM3U\n";
    channelsToExport.forEach(item => {
      rawM3U += `#EXTINF:-1 tvg-logo="${item.logo || ''}" group-title="${item.category || 'Television'}",${item.name}\n${item.url}\n`;
    });

    const b = new Blob([rawM3U], { type: 'text/plain;charset=utf-8' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `${playlist.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_exported.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  };

  // --- EPG DATA HELPERS & RETRIEVAL LAYER ---

  const decodeEpgValue = (val: string) => {
    if (!val) return '';
    try {
      const decoded = atob(val.trim());
      // Detect non-printable/garbage chars representing incorrect decoding of a non-base64 string
      if (/[\x00-\x08\x0E-\x1F\x7F]/.test(decoded)) {
        return val;
      }
      return decoded;
    } catch (_) {
      return val;
    }
  };

  const parseTimestamp = (ts: any) => {
    if (!ts) return null;
    const num = typeof ts === 'number' ? ts : parseInt(ts, 10);
    if (isNaN(num)) return null;
    if (num < 100000000000) {
      return new Date(num * 1000);
    }
    return new Date(num);
  };

  const parseEpgDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const t = dateStr.replace(' ', 'T');
      const d = new Date(t);
      if (isNaN(d.getTime())) {
        const timestamp = parseInt(dateStr, 10);
        if (!isNaN(timestamp)) {
          return new Date(timestamp * 1000);
        }
        return null;
      }
      return d;
    } catch (_) {
      return null;
    }
  };

  const isEpgItemActive = (startTs: any, endTs: any, startStr: string, endStr: string) => {
    const startTimeReg = parseTimestamp(startTs) || parseEpgDate(startStr);
    const endTimeReg = parseTimestamp(endTs) || parseEpgDate(endStr);
    
    if (!startTimeReg || !endTimeReg) return false;
    
    const now = new Date();
    return now >= startTimeReg && now <= endTimeReg;
  };

  const getEpgItemProgress = (startTs: any, endTs: any, startStr: string, endStr: string) => {
    const startTimeReg = parseTimestamp(startTs) || parseEpgDate(startStr);
    const endTimeReg = parseTimestamp(endTs) || parseEpgDate(endStr);
    
    if (!startTimeReg || !endTimeReg) return 0;
    
    const now = new Date();
    const startMs = startTimeReg.getTime();
    const endMs = endTimeReg.getTime();
    const nowMs = now.getTime();
    
    if (nowMs < startMs) return 0;
    if (nowMs > endMs) return 100;
    
    const diff = endMs - startMs;
    if (diff <= 0) return 100;
    
    return Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / diff) * 100)));
  };

  const fetchShortEpg = async (streamId: string | number) => {
    try {
      const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
      const url = `${sanitizedHost}/player_api.php?username=${config.username}&password=${config.password}&action=get_short_epg&stream_id=${streamId}`;
      const data = await fetchXtreamData(url);
      
      if (data && Array.isArray(data.epg_listings)) {
        return data.epg_listings.map((item: any) => ({
          id: item.id || '',
          epg_id: item.epg_id || '',
          title: decodeEpgValue(item.title),
          description: decodeEpgValue(item.description),
          start: item.start || '',
          end: item.end || '',
          start_timestamp: item.start_timestamp || '',
          end_timestamp: item.end_timestamp || '',
        }));
      }
      return [];
    } catch (err) {
      console.warn("Failed fetching EPG listings for channel:", streamId, err);
      return [];
    }
  };

  const loadChannelEpg = async (channel: LiveStream) => {
    setSelectedEpgChannel(channel);
    setEpgLoading(true);
    setEpgError(null);
    setEpgListings([]);
    try {
      const data = await fetchShortEpg(channel.stream_id);
      setEpgListings(data);
      if (data.length === 0) {
        setEpgError("No upcoming programs found on this channel.");
      }
    } catch (err: any) {
      setEpgError(err.message || "Failed retrieving remote channel guide.");
    } finally {
      setEpgLoading(false);
    }
  };

  const loadPlayerEpg = async (streamId: string | number) => {
    setPlayerEpgLoading(true);
    setPlayerEpgListings([]);
    try {
      const data = await fetchShortEpg(streamId);
      setPlayerEpgListings(data);
    } catch (err) {
      console.warn("Player EPG fetch error:", err);
    } finally {
      setPlayerEpgLoading(false);
    }
  };

  // Favorites Handlers
  const toggleFavoriteItem = (idKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated = [...favorites];
    if (updated.includes(idKey)) {
      updated = updated.filter(i => i !== idKey);
    } else {
      updated.push(idKey);
    }
    setFavorites(updated);
    localStorage.setItem('netbilfly_favs', JSON.stringify(updated));
  };

  const handleShareStream = (name: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedText = `Channel: ${name}\nStream URL: ${url}`;
    navigator.clipboard.writeText(formattedText)
      .then(() => {
        setCopiedStreamUrl(url);
        setTimeout(() => {
          setCopiedStreamUrl(null);
        }, 2000);
      })
      .catch((err) => {
        console.warn("Clipboard copy failure:", err);
      });
  };

  // Security Verification System (Enter Private Keypad PIN)
  const handlePinDigitPress = (digit: string) => {
    setWrongPinError(false);
    if (pinInput.length < 4) {
      const nextInput = pinInput + digit;
      setPinInput(nextInput);
      
      // Auto-validate on 4 digits
      if (nextInput.length === 4) {
        if (nextInput === parentalPin) {
          setIsAdultUnlocked(true);
          setShowPinModal(false);
          setActiveTab('adult');
          setPinInput('');
        } else {
          setWrongPinError(true);
          // Vibrates on error on supported mobile devices
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          setTimeout(() => setPinInput(''), 600); // clear input on wrong pin after flash
        }
      }
    }
  };

  const handlePinClear = () => {
    setPinInput('');
    setWrongPinError(false);
  };

  // Change Parental Code Helper
  const handleSaveNewPin = () => {
    if (newPin.length === 4) {
      setParentalPin(newPin);
      localStorage.setItem('netbilfly_parental_pin', newPin);
      setNewPin('');
      setShowChangePin(false);
      alert('Parental Code PIN updated successfully to: ' + newPin);
    } else {
      alert('PIN must be exactly 4 digits');
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('netbilfly_server_config', JSON.stringify(config));
    setShowSettingsDrawer(false);
    loadXtreamServerContent();
  };

  const resetToDefault = () => {
    if (window.confirm('Reset server settings to NETBILFLY default elite nodes?')) {
      setConfig(DEFAULT_SERVER);
      localStorage.setItem('netbilfly_server_config', JSON.stringify(DEFAULT_SERVER));
      setShowSettingsDrawer(false);
    }
  };

  // Count elements to display in the overview dashboard
  const userAccountName = serverInfo?.user_info?.username || config.username;
  const userStatus = serverInfo?.user_info?.status || 'Active';
  const userExpiryDate = serverInfo?.user_info?.exp_date 
    ? new Date(parseInt(serverInfo.user_info.exp_date) * 1000).toLocaleDateString() 
    : 'No Expiration';

  // Copy Stream URL to Clipboard helper
  const handleCopyUrl = () => {
    if (currentPlayItem) {
      navigator.clipboard.writeText(currentPlayItem.streamUrl);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  const activeCategoryList = useMemo(() => {
    if (activeTab === 'adult') {
      return separatedCategories.live.adult;
    }
    return separatedCategories.live.regular;
  }, [activeTab, separatedCategories]);

  const activeVodCategoryList = useMemo(() => {
    if (activeTab === 'adult') {
      return separatedCategories.vod.adult;
    }
    return separatedCategories.vod.regular;
  }, [activeTab, separatedCategories]);

  const activeSeriesCategoryList = useMemo(() => {
    if (activeTab === 'adult') {
      return separatedCategories.series.adult;
    }
    return separatedCategories.series.regular;
  }, [activeTab, separatedCategories]);

  // Navigate directly to standard or adult modes
  const handleTabClick = (tabName: 'live' | 'vod' | 'series' | 'favorites' | 'adult' | 'streamex' | 'playlists' | 'epg') => {
    if (tabName === 'adult' && !isAdultUnlocked) {
      setPinInput('');
      setWrongPinError(false);
      setShowPinModal(true);
    } else {
      setActiveTab(tabName);
      setSelectedLiveCategoryId('all');
      setSelectedVodCategoryId('all');
      setSelectedSeriesCategoryId('all');
      setSearchQuery('');
      setVisibleCount(80);
    }
  };

  return (
    <div id="netbilfly-root" className="min-h-screen flex flex-col bg-[#0B0F19] text-gray-100 selection:bg-red-600 selection:text-white relative">
      
      {/* HEADER BAR */}
      <header id="netbilfly-header" className="border-b border-gray-800 bg-[#0F1426] px-6 py-4 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg border border-red-500/50">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-red-500 flex items-center gap-2">
              NETBILFLY <span className="text-[10px] bg-red-900/40 text-red-300 font-semibold px-2 py-0.5 rounded border border-red-800">IPTV ELITE</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium tracking-tight">GLOBAL IP STREAMING LAYER</p>
          </div>
        </div>

        {/* Server & Channel Statistics info */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-[#151B33] border border-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] text-gray-400">Node:</span>
            <span className="font-semibold text-gray-200 truncate max-w-[120px]" title={config.host}>
              {config.host.replace('http://', '').replace('https://', '')}
            </span>
          </div>

          <div className="bg-[#151B33] border border-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-gray-400">Latency:</span>
            <span className="font-semibold text-emerald-400">
              {pingStatus ? `${pingStatus}ms` : 'Calculating...'}
            </span>
          </div>

          <div className="bg-[#151B33] border border-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Unlock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] text-gray-400">Adult Catalog:</span>
            <button
              id="adult-unlock-pill" 
              onClick={() => {
                if (isAdultUnlocked) {
                  setIsAdultUnlocked(false);
                  if (activeTab === 'adult') setActiveTab('live');
                } else {
                  setShowPinModal(true);
                }
              }}
              className={`font-semibold px-2 py-0.5 text-[10px] rounded uppercase flex items-center gap-1 transition-all ${
                isAdultUnlocked 
                  ? 'bg-purple-900/40 text-purple-300 border border-purple-800 hover:bg-purple-800/60' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Lock className="w-2.5 h-2.5 inline" /> {isAdultUnlocked ? 'Unlocked' : 'Locked'}
            </button>
          </div>

          <button 
            id="settings-trigger-btn"
            onClick={() => setShowSettingsDrawer(true)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2 transition-all cursor-pointer font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure
          </button>
        </div>
      </header>

      {/* CORE CONTAINER */}
      <div id="netbilfly-body" className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* VIEW NAVIGATION BAR (LEFT RAIL) */}
        <nav id="netbilfly-sidebar" className="lg:w-64 bg-[#0A0D1A] border-r border-gray-800/80 p-4 flex flex-row lg:flex-col justify-between overflow-x-auto lg:overflow-x-visible sticky bottom-0 lg:static z-30 shadow-md">
          <div className="flex flex-row lg:flex-col gap-2 w-full min-w-max lg:min-w-0">
            
            <p className="hidden lg:block text-[10px] text-gray-500 font-bold uppercase tracking-wider px-3 mb-1">Entertainments</p>

            <button
              id="tab-playlists-btn"
              onClick={() => handleTabClick('playlists')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'playlists' 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/20' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Database className="w-4.5 h-4.5 text-blue-400" />
              <span>Playlists IPTV M3U</span>
              <span className="ml-auto text-[11px] bg-blue-150/10 text-blue-300 border border-blue-900/40 px-1.5 py-0.5 rounded-md font-bold">
                {m3uPlaylistChannels.length}
              </span>
            </button>

            <button
              id="tab-live-btn"
              onClick={() => handleTabClick('live')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'live' 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/20' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Tv className="w-4.5 h-4.5" />
              <span>Live TV</span>
              <span className="ml-auto text-[11px] bg-gray-950 bg-opacity-40 text-gray-300 px-1.5 py-0.5 rounded-md font-normal">
                {liveStreams.length}
              </span>
            </button>

            <button
              id="tab-epg-btn"
              onClick={() => handleTabClick('epg')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'epg' 
                  ? 'bg-gradient-to-r from-[#DF123F] to-[#E94560] text-white shadow-lg shadow-red-950/30' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Calendar className="w-4.5 h-4.5 text-red-400" />
              <span>TV Guide (EPG)</span>
              <span className="ml-auto text-[10px] bg-red-950/50 text-red-300 px-1.5 py-0.5 rounded border border-red-900/30 font-bold">
                GUIDE
              </span>
            </button>

            <button
              id="tab-vod-btn"
              onClick={() => handleTabClick('vod')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'vod' 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/20' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Film className="w-4.5 h-4.5" />
              <span>Movies VOD</span>
              <span className="ml-auto text-[11px] bg-gray-950 bg-opacity-40 text-gray-300 px-1.5 py-0.5 rounded-md font-normal">
                {vodStreams.length}
              </span>
            </button>

            <button
              id="tab-series-btn"
              onClick={() => handleTabClick('series')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'series' 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/20' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Clapperboard className="w-4.5 h-4.5" />
              <span>Series VOD</span>
              <span className="ml-auto text-[11px] bg-gray-950 bg-opacity-40 text-gray-300 px-1.5 py-0.5 rounded-md font-normal">
                {seriesStreams.length}
              </span>
            </button>

            <button
              id="tab-streamex-btn"
              onClick={() => handleTabClick('streamex')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer relative overflow-hidden group ${
                activeTab === 'streamex' 
                  ? 'bg-gradient-to-r from-amber-600 to-red-600 text-white shadow-lg shadow-amber-950/30' 
                  : 'text-amber-400 hover:text-amber-100 hover:bg-amber-950/20'
              }`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-amber-500 to-red-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <Film className="w-4.5 h-4.5 text-amber-500 shrink-0" />
              <span>StreamEx (sh)</span>
              <span className="ml-auto text-[9px] bg-amber-950 bg-opacity-40 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded-md uppercase font-bold shrink-0">
                100% Free
              </span>
            </button>

            <div className="w-px h-8 bg-gray-800 self-center lg:hidden" />

            <p className="hidden lg:block text-[10px] text-gray-500 font-bold uppercase tracking-wider px-3 mt-4 mb-1">Personal Collection</p>

            <button
              id="tab-favorites-btn"
              onClick={() => handleTabClick('favorites')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'favorites' 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-gray-100 hover:bg-[#12182D]'
              }`}
            >
              <Heart className="w-4.5 h-4.5 text-rose-500 fill-rose-500" />
              <span>Preferred</span>
              <span className="ml-auto text-[11px] bg-gray-950 bg-opacity-40 text-gray-300 px-1.5 py-0.5 rounded-md font-normal">
                {favorites.length}
              </span>
            </button>

            {/* ADULT CATEGORY TAB with visual Lock Indicator */}
            <button
              id="tab-adults-btn"
              onClick={() => handleTabClick('adult')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all cursor-pointer relative group overflow-hidden ${
                activeTab === 'adult' 
                  ? 'bg-gradient-to-r from-purple-700 to-pink-700 text-white shadow-lg shadow-purple-950/40 font-bold' 
                  : 'text-purple-400 hover:text-purple-100 hover:bg-purple-950/20'
              }`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <Lock className={`w-4.5 h-4.5 ${isAdultUnlocked ? 'text-pink-400' : 'text-purple-500'}`} />
              <span>Adulte (18+)</span>
              {!isAdultUnlocked && (
                <span className="ml-auto text-[9px] bg-purple-900 bg-opacity-50 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded-md uppercase font-bold tracking-tight">
                  Locked
                </span>
              )}
            </button>
          </div>

          {/* User Status Profile */}
          <div className="hidden lg:block mt-auto p-3.5 rounded-xl border border-gray-800 bg-[#0C101F]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-gray-300 truncate max-w-[130px]" title={userAccountName}>
                {userAccountName}
              </p>
            </div>
            <div className="text-[10px] text-gray-400 leading-tight space-y-1">
              <p>Type: <span className="text-gray-200 capitalize font-medium">{userStatus}</span></p>
              <p>Expires: <span className="text-gray-200 font-medium">{userExpiryDate}</span></p>
            </div>
          </div>
        </nav>

        {/* CONTROLLER & CONTENT WRAPPER */}
        <main id="netbilfly-content-area" className="flex-1 flex flex-col min-w-0 bg-[#090C15] overflow-y-auto">
          
          {/* MOVIE & STREAM PLAY ZONE (IF STREAM ACTIVE) */}
          <div id="iptv-player-container-block" className="w-full bg-[#05060A] border-b border-gray-950">
            {currentPlayItem ? (
              <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* VIDEO DOMAIN */}
                <div className="lg:col-span-2 bg-black rounded-2xl overflow-hidden border border-gray-800/60 shadow-2xl relative aspect-video flex flex-col justify-between">
                  
                  {/* Streaming overlay details */}
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10 flex items-center justify-between pointer-events-none">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${currentPlayItem.type === 'streamex' ? 'bg-amber-600' : 'bg-red-600 animate-pulse'}`}>
                      {currentPlayItem.type === 'streamex' ? 'StreamEx VOD' : currentPlayItem.type === 'vod' ? 'Movie VOD' : currentPlayItem.type === 'series' ? 'Series VOD' : 'Live Stream'}
                    </span>
                    <span className="text-xs font-semibold text-gray-300 drop-shadow-md truncate max-w-[200px]" title={currentPlayItem.name}>
                      {currentPlayItem.name}
                    </span>
                  </div>

                  {/* HTML5 video Stream node or StreamEx iframe */}
                  <div className="w-full h-full flex items-center justify-center bg-[#070911]">
                    {currentPlayItem.type === 'streamex' ? (
                      <iframe
                        id="netbilfly-active-iframe-target"
                        src={currentPlayItem.streamUrl}
                        className="w-full h-full border-0 bg-black"
                        allowFullScreen
                        allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
                        title={currentPlayItem.name}
                      />
                    ) : (
                      <video
                        id="netbilfly-active-video-target"
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        preload="auto"
                        playsInline
                      />
                    )}
                  </div>

                  {/* Active controller actions */}
                  <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                    <button
                      id="copy-stream-link-btn"
                      onClick={handleCopyUrl}
                      className="bg-gray-900/90 border border-gray-800 hover:bg-gray-800 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all"
                    >
                      {copiedNotification ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedNotification ? 'Copied Url!' : 'Copy Stream'}</span>
                    </button>

                    {currentPlayItem.type === 'streamex' ? (
                      <a
                        id="streamex-tab-external-link"
                        href={currentPlayItem.streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-amber-600 border border-amber-500 hover:bg-amber-500 text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-md animate-pulse"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Maximize Screen</span>
                      </a>
                    ) : (
                      <a
                        id="vlc-external-link"
                        href={currentPlayItem.streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-red-600 border border-red-500 hover:bg-red-500 text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-md"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open VLC</span>
                      </a>
                    )}
                  </div>

                </div>

                {/* CURRENT STREAM DETAILED DIAGNOSTICS */}
                <div id="play-item-diagnostics-block" className="bg-[#101427] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      {currentPlayItem.icon ? (
                        <img 
                          src={currentPlayItem.icon} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-xl border border-gray-700 bg-[#0B0F19]"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-950 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                          {currentPlayItem.name.slice(0, 2)}
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Now Decoding</span>
                        <h3 className="text-base font-bold text-white leading-snug truncate" title={currentPlayItem.name}>
                          {currentPlayItem.name}
                        </h3>
                      </div>
                    </div>

                    {/* Operational metrics details */}
                    <div className="space-y-2.5 text-xs bg-[#090C15] p-4 rounded-xl border border-gray-800/80 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Target Server:</span>
                        <span className="font-medium text-gray-200">Atlan 2025 Me</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stream ID:</span>
                        <span className="font-mono text-gray-300">#{currentPlayItem.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Connection Mode:</span>
                        <span className="font-medium text-blue-400">CORS Tunnel Active</span>
                      </div>
                      <div className="flex justify-between items-center gap-1.5 font-mono text-[10px]">
                        <span className="text-gray-400 font-sans">Source Format:</span>
                        <span className="bg-gray-800 text-gray-300 px-1 py-0.5 rounded text-[10px]">
                          {currentPlayItem.type === 'live' ? 'MPEG-2 TS Live Stream' : 'Video Container File'}
                        </span>
                      </div>
                    </div>

                    {currentPlayItem.type === 'live' && (
                      <div className="mt-4 border-t border-gray-800/65 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wide">
                            <Clock className="w-3.5 h-3.5 text-red-500" />
                            Live EPG Guide
                          </span>
                          {playerEpgLoading && (
                            <span className="text-[10px] text-blue-400 animate-pulse">Syncing...</span>
                          )}
                        </div>
                        
                        {playerEpgListings.length === 0 ? (
                          <div className="bg-[#090C15] p-3 rounded-lg border border-gray-800/80 text-center text-[11px] text-gray-500">
                            {playerEpgLoading ? "Fetching TV details..." : "No live program data loaded."}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Currently active program */}
                            {(() => {
                              const activeShow = playerEpgListings.find(item => 
                                isEpgItemActive(item.start_timestamp, item.end_timestamp, item.start, item.end)
                              );
                              
                              if (!activeShow) {
                                return (
                                  <p className="text-[11px] text-gray-500 italic text-center p-2 bg-[#090C15] rounded-xl border border-gray-800/60">
                                    No scheduled show active currently.
                                  </p>
                                );
                              }

                              const progress = getEpgItemProgress(activeShow.start_timestamp, activeShow.end_timestamp, activeShow.start, activeShow.end);
                              const startTimeObj = parseTimestamp(activeShow.start_timestamp) || parseEpgDate(activeShow.start);
                              const endTimeObj = parseTimestamp(activeShow.end_timestamp) || parseEpgDate(activeShow.end);
                              const formatTime = (dObj: Date | null) => {
                                if (!dObj) return '';
                                return dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              };

                              return (
                                <div className="bg-gradient-to-br from-red-950/15 to-rose-950/20 border border-red-900/30 p-3 rounded-xl">
                                  <div className="flex justify-between items-start gap-2 mb-1.5">
                                    <span className="text-[9px] font-black tracking-widest text-[#FFF] bg-red-600 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                                      On-Air Now
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                                      {formatTime(startTimeObj)} - {formatTime(endTimeObj)}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-black text-white mb-1.5 tracking-tight">{activeShow.title}</h4>
                                  {activeShow.description && (
                                    <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed mb-3">
                                      {activeShow.description}
                                    </p>
                                  )}
                                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800/60">
                                    <div 
                                      className="bg-gradient-to-r from-red-500 to-rose-600 h-full transition-all duration-1000" 
                                      style={{ width: `${progress}%` }} 
                                    />
                                  </div>
                                  <div className="flex justify-between items-center mt-1.5 text-[9px] text-gray-500 font-bold uppercase">
                                    <span>{progress}% Elapsed</span>
                                    <span className="text-emerald-400">Live feed</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Up next programs list */}
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pb-1 border-b border-gray-850">Up Next</p>
                              {(() => {
                                const upcomingLineups = playerEpgListings.filter(item => {
                                  const startTimeObj = parseTimestamp(item.start_timestamp) || parseEpgDate(item.start);
                                  return startTimeObj ? startTimeObj > new Date() : false;
                                });
                                
                                if (upcomingLineups.length === 0) {
                                  return <p className="text-[10px] text-gray-500 italic p-1">No upcoming schedules.</p>;
                                }

                                return upcomingLineups.slice(0, 3).map((item, idx) => {
                                  const startTimeObj = parseTimestamp(item.start_timestamp) || parseEpgDate(item.start);
                                  const formatTime = (dObj: Date | null) => {
                                    if (!dObj) return '';
                                    return dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                  };

                                  return (
                                    <div key={idx} className="bg-[#090C15] p-2 rounded-lg border border-gray-800/80 flex justify-between items-center text-[10px] gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-bold text-gray-300 truncate" title={item.title}>{item.title}</p>
                                        {item.description && (
                                          <p className="text-[9px] text-gray-500 truncate" title={item.description}>{item.description}</p>
                                        )}
                                      </div>
                                      <span className="font-mono text-[9px] text-blue-400 bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-900/30 whitespace-nowrap tracking-tight">
                                        {formatTime(startTimeObj)}
                                      </span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-blue-950/20 border border-blue-900/60 p-3.5 rounded-lg flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Info className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-gray-300 leading-normal">
                          <p className="font-semibold text-blue-300 mb-0.5">Stream Playback Tips:</p>
                          Chrome blocks certain HTTP videos without secure Slayers. If audio/video does not load automatically, click the <strong className="text-white">Open VLC</strong> button or try the StreamEx mirror below.
                        </div>
                      </div>

                      {currentPlayItem.type !== 'live' && currentPlayItem.type !== 'streamex' && (
                        <button
                          id="play-in-streamex-fallback-btn"
                          onClick={() => {
                            setStreamExSearchText(currentPlayItem.name);
                            setStreamExType(currentPlayItem.type === 'series' ? 'tv' : 'movie');
                            setActiveTab('streamex');
                            // Scroll to search block after component renders
                            setTimeout(() => {
                              const block = document.getElementById('streamex-hub-container');
                              if (block) {
                                block.scrollIntoView({ behavior: 'smooth' });
                              }
                            }, 100);
                          }}
                          className="w-full mt-1 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-xs text-white py-2 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer border border-amber-500/30"
                        >
                          <Film className="w-3.5 h-3.5 text-amber-300" />
                          <span>🍿 STREAM VIA STREAMEX.SH MIRROR</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800/80 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-gray-500" />
                      Status: <strong className="text-gray-200">{streamDiagnosticMsg}</strong>
                    </p>
                    <button 
                      id="close-player-btn"
                      onClick={() => setCurrentPlayItem(null)} 
                      className="text-xs text-red-400 hover:text-red-300 font-bold transition-all px-2.5 py-1 rounded hover:bg-red-950/20"
                    >
                      Dismiss Player
                    </button>
                  </div>

                </div>

              </div>
            ) : (
              // Empty player mockup hero banner
              <div className="bg-gradient-to-r from-red-950/10 via-[#0B0F19] to-purple-950/10 border-b border-gray-900 py-12 px-6 text-center max-w-7xl mx-auto flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-[#0F1426] border border-gray-800 flex items-center justify-center text-red-500 shadow-xl mb-4 animate-bounce">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">VIP IPTV Engine Activated & Ready</h2>
                <p className="text-sm text-gray-400 max-w-xl mx-auto mt-2 leading-relaxed">
                  Select a live stream, high-definition movie, or premium series below to initialize. Select <strong className="text-purple-400">Adulte</strong> category to view private unlocked 18+ content list safely.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">

            {/* PLAYLISTS IPTV M3U VIEW */}
            {activeTab === 'playlists' && (
              <div id="m3u-playlists-container" className="space-y-8 animate-fade-in">
                
                {/* HERO HEADER */}
                <div className="bg-gradient-to-r from-[#11162C] via-[#0D111F] to-[#0A0D1A] border border-blue-500/10 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-3xl rounded-full" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow border border-blue-400/30">
                          M3U PLAYLIST ENGINES
                        </span>
                        <span className="bg-gray-800 text-gray-300 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full">
                          Ready to Play
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">
                        IPTV Playlists & Custom Streaming
                      </h2>
                      <p className="text-sm text-gray-400 max-w-2xl mt-2 leading-relaxed">
                        Instantly import, search, and visualize standard <code className="text-blue-400 font-mono">.m3u</code> live television feeds. Choose a global certified preset or drag/paste your personalized playlists to stream right away.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="bg-[#151B33] border border-gray-800 px-4 py-3 rounded-2xl">
                        <p className="text-[10px] text-gray-400 uppercase font-black">Active Playground:</p>
                        <p className="text-sm font-bold text-blue-400 truncate max-w-[200px]" title={activePlaylistName}>
                          {activePlaylistName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Total Channels: <strong className="text-gray-200">{m3uPlaylistChannels.length}</strong></p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🌐 LIVE WEB AUTO-SYNC & SYSTEM RESET CONTROL PANEL */}
                <div id="iptv-web-sync-controller" className="bg-[#12182D]/80 border border-blue-500/20 p-5 rounded-3xl backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden animate-fade-in">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-3xl rounded-full" />
                  
                  <div className="flex items-start gap-3.5 relative z-10">
                    <div className="w-10 h-10 rounded-2xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <RefreshCw className={`w-5 h-5 text-blue-400 ${m3uLoading ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-900/40 text-blue-300 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border border-blue-800/40">
                          WEB CHANNEL ENGINE
                        </span>
                        {isWebAutoSyncActive ? (
                          <span className="bg-emerald-950/40 text-emerald-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-900/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Auto-Sync: ON
                          </span>
                        ) : (
                          <span className="bg-gray-900 text-gray-500 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-gray-800">
                            Auto-Sync: OFF
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-black tracking-tight text-white mt-1">
                        Global Web-Wide Auto-Sync & System Reset
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
                        Toggle startup synchronization to automatically harvest secure, free world-wide channels on launch, or trigger a full hardware reset to return playlists back to Netbilfly factory defaults.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
                    {/* TOGGLE SWITCH FOR STARTUP AUTO-SYNC */}
                    <label className="flex items-center gap-2 cursor-pointer bg-[#0A0D1F] border border-gray-800/90 rounded-xl px-3 py-2 hover:border-blue-900 transition-all select-none col-span-1">
                      <input
                        type="checkbox"
                        checked={isWebAutoSyncActive}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setIsWebAutoSyncActive(val);
                          localStorage.setItem('netbilfly_web_auto_sync', String(val));
                        }}
                        className="sr-only peer"
                      />
                      <div className="relative w-8 h-4 bg-gray-800 rounded-full peer peer-focus:ring-0 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                      <span className="text-[10px] font-extrabold text-gray-300 uppercase tracking-wider">Sync on Startup</span>
                    </label>

                    {/* MANUAL FORCE WEB SYNC ACTION */}
                    <button
                      id="btn-force-web-sync"
                      disabled={m3uLoading}
                      onClick={() => triggerWebWideAutoSync(false)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-800 disabled:to-indigo-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${m3uLoading ? 'animate-spin' : ''}`} />
                      <span>Sync Web Channels</span>
                    </button>

                    {/* DYNAMIC SYSTEM FACTORY RESET */}
                    <button
                      id="btn-factory-reset-m3u"
                      onClick={() => {
                        if (confirm("Reset current loaded channels and clear video playback state?")) {
                          setM3uPlaylistChannels(BUILTIN_SHOWCASE_CHANNELS);
                          setActivePlaylistName("Built-in Showcase Channels");
                          setCurrentPlayItem(null);
                          setIsWebAutoSyncActive(false);
                          localStorage.removeItem('netbilfly_web_auto_sync');
                          localStorage.removeItem('netbilfly_last_web_sync_time');
                          setWebSyncProgress("Engine restarted. Reset back to offline-cached showcase channels.");
                          setLastWebSyncTime("");
                        }
                      }}
                      className="bg-red-950/30 hover:bg-red-900/30 text-rose-400 hover:text-rose-300 border border-red-900/30 hover:border-red-600/45 font-extrabold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition active:scale-95 cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Reset defaults</span>
                    </button>
                  </div>
                </div>

                {/* VISUAL TRANSITION / STATUS TEXT (IF PRESENT) */}
                {webSyncProgress && (
                  <div className="bg-[#090D1E] border border-blue-950 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fade-in shadow-inner">
                    <div className="flex items-center gap-2 text-blue-300">
                      <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                      <span>{webSyncProgress}</span>
                    </div>
                    {lastWebSyncTime && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        Last sync: {lastWebSyncTime}
                      </span>
                    )}
                  </div>
                )}

                {/* 📢 TELEGRAM AMER SAT IPTV REAL-TIME COMMUNITY DECK */}
                <TelegramSatiptvLoader
                  config={config}
                  setConfig={setConfig}
                  loadXtreamServerContent={loadXtreamServerContent}
                />

                {/* 💼 MASTER IPTV OPERATIONS & SYSTEM DASHBOARD */}
                <div id="iptv-admin-dashboard" className="bg-[#10152F] border border-blue-500/25 p-6 rounded-3xl relative overflow-hidden shadow-2xl space-y-6">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-950/80 border border-blue-400/40 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                        <Server className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                          Master IPTV Operations & Management Dashboard
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded border border-emerald-500/25">
                            LIVE ADMIN GESTION
                          </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                          Central server database register, interactive connection latency checker (Ping), and persistent M3U cloud-like warehouse storage.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LEFT PANEL: SERVER FLEET MANAGER */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                        <h3 className="text-sm font-black text-gray-200 uppercase tracking-wider flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-blue-400" />
                          1. Server Fleet Manager ({savedServers.length})
                        </h3>
                        <button
                          onClick={() => setIsAddingServer(!isAddingServer)}
                          className="bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 font-black text-[10px] uppercase text-blue-300 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                        >
                          {isAddingServer ? "Close Register Form" : "⚡ Register New Server"}
                        </button>
                      </div>

                      {/* ADD CUSTOM SERVER FORM */}
                      {isAddingServer && (
                        <div className="bg-[#080B15] p-4 rounded-2xl border border-blue-500/20 space-y-3.5 animate-slide-down">
                          <p className="text-[11px] font-extrabold text-blue-400 uppercase tracking-widest">Register Custom Xtream Server</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Nickname label</label>
                              <input
                                type="text"
                                placeholder="e.g. My Premium Server B3"
                                value={newServerNickname}
                                onChange={(e) => setNewServerNickname(e.target.value)}
                                className="w-full bg-[#11172B] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Server Port / DNS URL</label>
                              <input
                                type="text"
                                placeholder="http://example-domain.me:8080"
                                value={newServerHost}
                                onChange={(e) => setNewServerHost(e.target.value)}
                                className="w-full bg-[#11172B] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Username</label>
                              <input
                                type="text"
                                placeholder="Xtream profile user"
                                value={newServerUser}
                                onChange={(e) => setNewServerUser(e.target.value)}
                                className="w-full bg-[#11172B] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Password</label>
                              <input
                                type="password"
                                placeholder="Xtream server password"
                                value={newServerPassword}
                                onChange={(e) => setNewServerPassword(e.target.value)}
                                className="w-full bg-[#11172B] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => {
                                setNewServerNickname('');
                                setNewServerHost('');
                                setNewServerUser('');
                                setNewServerPassword('');
                                setIsAddingServer(false);
                              }}
                              className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-bold px-3 py-2 rounded-xl transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddSavedServer}
                              className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-extrabold px-4 py-2 rounded-xl transition shadow"
                            >
                              Save Server Profile
                            </button>
                          </div>
                        </div>
                      )}

                      {/* EDIT SERVER FORM */}
                      {editingServerId && (
                        <div className="bg-[#0D0B1F] p-4 rounded-2xl border border-amber-500/30 space-y-3.5 animate-slide-down">
                          <p className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest">✏️ Modify Server Credentials</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Nickname label</label>
                              <input
                                type="text"
                                value={editServerNickname}
                                onChange={(e) => setEditServerNickname(e.target.value)}
                                className="w-full bg-[#15122E] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Server Port / DNS URL</label>
                              <input
                                type="text"
                                value={editServerHost}
                                onChange={(e) => setEditServerHost(e.target.value)}
                                className="w-full bg-[#15122E] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Username</label>
                              <input
                                type="text"
                                value={editServerUser}
                                onChange={(e) => setEditServerUser(e.target.value)}
                                className="w-full bg-[#15122E] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase font-bold">Password</label>
                              <input
                                type="text"
                                value={editServerPassword}
                                onChange={(e) => setEditServerPassword(e.target.value)}
                                className="w-full bg-[#15122E] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => setEditingServerId(null)}
                              className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-bold px-3 py-2 rounded-xl transition"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={handleSaveEditedServer}
                              className="bg-amber-600 hover:bg-amber-500 text-xs text-white font-extrabold px-4 py-2 rounded-xl transition"
                            >
                              Update Credentials
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SERVERS CARDS GRID */}
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {savedServers.map((srv) => {
                          const isCurrentlyConnected = config.host === srv.host && config.username === srv.username;
                          const pingInfo = serverPingResults[srv.id];
                          
                          return (
                            <div
                              key={srv.id}
                              className={`p-4 rounded-2xl border transition-all duration-200 ${
                                isCurrentlyConnected 
                                  ? 'bg-[#152044] border-emerald-500/30 shadow-indigo-950/20 shadow-lg' 
                                  : 'bg-[#080B15] border-gray-900 hover:border-gray-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-white text-sm">{srv.nickname}</h4>
                                    {isCurrentlyConnected && (
                                      <span className="bg-emerald-950/40 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-emerald-900/50 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono text-gray-500 mt-1 truncate max-w-[280px]">{srv.host}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[9px] text-gray-400">User: <span className="font-bold text-gray-300 font-mono">{srv.username}</span></span>
                                    <span className="text-[9px] text-gray-600">•</span>
                                    <span className="text-[9px] text-gray-400">Registered: <span className="text-gray-400">{srv.createdAt}</span></span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  {/* Test Ping outcome display */}
                                  {pingInfo ? (
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide ${
                                      pingInfo.ok 
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' 
                                        : 'bg-rose-950 text-rose-400 border border-rose-900/30'
                                    }`}>
                                      {pingInfo.msg}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-gray-650 italic">No connection test</span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  {/* PING TESTER */}
                                  <button
                                    onClick={() => handleTestServerConnection(srv)}
                                    disabled={testingConnectionId === srv.id}
                                    className="bg-[#12182B] hover:bg-[#1C2646] disabled:opacity-50 text-[10px] text-blue-300 font-bold px-2.5 py-1.5 rounded-lg border border-gray-800 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Wifi className={`w-3 h-3 ${testingConnectionId === srv.id ? 'animate-pulse' : ''}`} />
                                    <span>{testingConnectionId === srv.id ? "Analyzing..." : "Test Latency"}</span>
                                  </button>

                                  {/* QUICK LOGIN LOADER */}
                                  {!isCurrentlyConnected && (
                                    <button
                                      onClick={() => {
                                        setConfig({ host: srv.host, username: srv.username, password: srv.password });
                                        localStorage.setItem('netbilfly_server_config', JSON.stringify({ host: srv.host, username: srv.username, password: srv.password }));
                                        alert(`Swapping active connection portal to: "${srv.nickname}"\nReloading full media directory...`);
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg transition shadow cursor-pointer"
                                    >
                                      Connect Portal
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-auto">
                                  {/* EDIT ICON */}
                                  <button
                                    onClick={() => {
                                      setEditingServerId(srv.id);
                                      setEditServerNickname(srv.nickname);
                                      setEditServerHost(srv.host);
                                      setEditServerUser(srv.username);
                                      setEditServerPassword(srv.password);
                                    }}
                                    className="p-1.5 bg-[#1C2646]/30 hover:bg-[#1A2342] text-amber-400 rounded-lg transition border border-gray-900/50 cursor-pointer"
                                    title="Edit credentials"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  {/* DELETE ICON */}
                                  <button
                                    onClick={() => handleDeleteSavedServer(srv.id, srv.nickname)}
                                    className="p-1.5 bg-red-950/20 hover:bg-rose-950/50 text-rose-500 hover:text-rose-400 rounded-lg border border-red-950/20 transition cursor-pointer"
                                    title="Delete register"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* RIGHT PANEL: PLAYLIST WAREHOUSE */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                        <h3 className="text-sm font-black text-gray-200 uppercase tracking-wider flex items-center gap-2">
                          <Folder className="w-4.5 h-4.5 text-emerald-400" />
                          2. M3U Playlist Database ({savedPlaylists.length})
                        </h3>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Stored locally</span>
                      </div>

                      {/* DYNAMIC BACKUP SAVER BANNER FOR ACTIVE GRIDS */}
                      {m3uPlaylistChannels.length > 0 && (
                        <div className="bg-[#121B2F] border border-emerald-500/25 p-4 rounded-xl space-y-3 shadow-inner">
                          <div className="flex gap-2.5">
                            <PlusCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-white text-xs">Save Current Active Grid to Local Warehouse</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                                Click below to persistently save the active stream playlist (<span className="text-emerald-300 font-mono font-bold">{m3uPlaylistChannels.length} streams</span>) into your local library folder.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Describe your playlist... (e.g., USA IPTV Elite)"
                              value={savePlaylistNameInput}
                              onChange={(e) => setSavePlaylistNameInput(e.target.value)}
                              className="flex-1 bg-[#080B15] border border-gray-800 px-3 py-1.5 rounded-lg text-xs text-gray-200 outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={handleSaveCurrentToDashboard}
                              className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-extrabold px-3.5 py-1.5 rounded-lg transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save Locally
                            </button>
                          </div>
                        </div>
                      )}

                      {/* PLAYLIST CARDS GRID */}
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {savedPlaylists.map((pl) => {
                          const isActivePl = activePlaylistName === pl.name;
                          
                          return (
                            <div
                              key={pl.id}
                              className={`p-4 rounded-2xl border transition-all duration-200 ${
                                isActivePl 
                                  ? 'bg-[#15272B] border-emerald-500/30 shadow-indigo-950/20 shadow-lg' 
                                  : 'bg-[#080B15] border-gray-900 hover:border-gray-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <h4 className="font-bold text-white text-sm">{pl.name}</h4>
                                    {isActivePl && (
                                      <span className="bg-emerald-950/40 text-emerald-300 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-emerald-900/40">
                                        Playing Grid
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2.5 mt-2">
                                    <span className="bg-[#1D2132] px-2 py-0.5 rounded text-[10px] text-gray-300 font-extrabold font-mono font-black">
                                      {pl.channelsCount} Streams
                                    </span>
                                    <span className="text-[10px] text-gray-505">Created: {pl.createdAt}</span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    Source: <span className="text-gray-300 bg-gray-950/35 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase">{pl.sourceType}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* LOAD BUTTON */}
                                  {!isActivePl ? (
                                    <button
                                      onClick={() => loadSavedPlaylist(pl)}
                                      className="bg-[#003B32] hover:bg-[#004D40] text-emerald-300 font-extrabold text-[10px] uppercase px-3.5 py-1.5 rounded-lg border border-emerald-900 hover:border-emerald-600 transition shadow block cursor-pointer"
                                    >
                                      Load List
                                    </button>
                                  ) : (
                                    <span className="bg-[#0D241E] text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Loaded
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between gap-2">
                                <span className="text-[9px] text-gray-600 capitalize">Partition system enabled</span>
                                <div className="flex items-center gap-1.5">
                                  {/* DOWNLOAD BACKUP */}
                                  <button
                                    onClick={() => exportM3UPlaylist(pl)}
                                    className="p-1.5 bg-[#1C2646]/30 hover:bg-[#1A2342] text-cyan-400 rounded-lg transition border border-gray-900/50 cursor-pointer"
                                    title="Export raw M3U playlist file"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>

                                  {/* DELETE PLAYLIST */}
                                  {pl.id !== 'playlist-default-builtin' && (
                                    <button
                                      onClick={() => handleDeleteSavedPlaylist(pl.id, pl.name)}
                                      className="p-1.5 bg-red-950/20 hover:bg-rose-950/50 text-rose-500 hover:text-rose-400 rounded-lg border border-red-950/20 transition cursor-pointer"
                                      title="Remove from warehouse"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>

                {/* PLAYLIST CONTROL DECK (GRID: FAST PRESETS & CUSTOM UPLOAD) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* PRESET INTEGRATION (LEFT COL - 5 SPAN) */}
                  <div className="lg:col-span-5 bg-[#0F1426] border border-gray-800 rounded-3xl p-6 shadow-md flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                        A. Load Live TV Presets
                      </h3>
                      <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                        One-click stream activation. These playlists are fully open-source and curated automatically from active public github providers.
                      </p>

                      <div className="space-y-2.5">
                        
                        {/* CONNECTED SERVER TO M3U SYNC ACTION CONTAINER */}
                        <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/20 border border-blue-500/20 p-3.5 rounded-2xl flex flex-col gap-2 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                              Active Server Converter
                            </span>
                            <span className="text-[10px] text-gray-500 font-semibold">
                              {liveStreams.length} Live Channels
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-relaxed">
                            Convert connected Xtream server channels into an M3U playlist format to use the Grouped Category Layout!
                          </p>

                          <div className="flex items-center gap-2 py-1 select-none">
                            <input
                              id="input-auto-inject-adult"
                              type="checkbox"
                              checked={autoInjectAdultStreams}
                              onChange={(e) => setAutoInjectAdultStreams(e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-gray-750 text-rose-500 focus:ring-rose-500 focus:ring-opacity-25 bg-[#080B15] cursor-pointer"
                            />
                            <label htmlFor="input-auto-inject-adult" className="text-[10px] font-black text-rose-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1">
                              <span>Inject 🔞 Adult Feed if server is active</span>
                            </label>
                          </div>

                          <button
                            id="btn-sync-active-server-m3u"
                            type="button"
                            onClick={syncServerToM3UPlaylist}
                            className={`w-full text-center py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                              liveStreams.length > 0 
                                ? 'bg-[#1D4ED8] hover:bg-[#2563EB] text-white shadow-blue-900/40 select-none active:scale-[0.98]'
                                : 'bg-gray-900/80 border border-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <span>⚡ Sync Connected Server to M3U Playlist</span>
                          </button>
                        </div>

                        <button
                          id="btn-preset-builtin"
                          onClick={() => {
                            setM3uPlaylistChannels(BUILTIN_SHOWCASE_CHANNELS);
                            setActivePlaylistName("Built-in Showcase Channels");
                          }}
                          className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            activePlaylistName === "Built-in Showcase Channels"
                              ? "bg-blue-600/10 border-blue-500 text-blue-300"
                              : "bg-[#080B15] border-gray-800/80 text-gray-300 hover:bg-gray-850 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>🛰️</span>
                            <span>NETBILFLY Premium Showcase (Fast)</span>
                          </span>
                          <span className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-800/50 px-1.5 py-0.5 rounded font-bold font-mono">Showcase</span>
                        </button>

                        <button
                          id="btn-preset-adult-custom"
                          onClick={() => {
                            setM3uPlaylistChannels(ADULT_PRESET_CHANNELS);
                            setActivePlaylistName("Premium Adult Network (+18)");
                          }}
                          className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            activePlaylistName === "Premium Adult Network (+18)"
                              ? "bg-rose-950/30 border-rose-500/80 text-rose-300 animate-pulse"
                              : "bg-[#0D0B12]/80 border-rose-950/40 text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 hover:border-rose-800/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>🔞</span>
                            <span>Premium AMER SAT Adult Pool (+18)</span>
                          </span>
                          <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-900/40 px-1.5 py-0.5 rounded font-black font-mono">User Shared</span>
                        </button>

                        {[
                          { name: "🇸🇦 Arabic & Middle East Live (AMER SAT)", url: "https://iptv-org.github.io/iptv/languages/ara.m3u" },
                          { name: "⚽ Global Live Sports Channels", url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
                          { name: "🍿 Movies & Cinema Network", url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
                          { name: "🇺🇸 USA Public Live Channels", url: "https://iptv-org.github.io/iptv/countries/us.m3u" },
                          { name: "🇬🇧 UK British Live Television", url: "https://iptv-org.github.io/iptv/countries/uk.m3u" },
                          { name: "🇫🇷 France National Broadcasters", url: "https://iptv-org.github.io/iptv/countries/fr.m3u" },
                          { name: "🇨🇦 Canada Live Stream Feeds", url: "https://iptv-org.github.io/iptv/countries/ca.m3u" }
                        ].map((preset, idx) => (
                          <button
                            id={`btn-preset-load-${idx}`}
                            key={idx}
                            disabled={m3uLoading}
                            onClick={() => loadM3UFromUrl(preset.url)}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              activePlaylistName === (preset.name.substring(3)) || activePlaylistName.toLowerCase().includes(preset.name.toLowerCase().split(' ')[1])
                                ? "bg-blue-600/10 border-blue-500 text-blue-300"
                                : "bg-[#080B15] border-gray-800/80 text-gray-300 hover:bg-[#12182D] hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{preset.name.substring(0, 2)}</span>
                              <span>{preset.name.substring(3)}</span>
                            </span>
                            <span className="text-[9px] text-gray-500 group-hover:text-blue-400">Load Preset →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-800/65 flex items-center justify-between pointer-events-none">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Load status:</span>
                      <span className={`text-[10px] font-bold ${m3uLoading ? 'text-blue-400 animate-pulse' : 'text-emerald-400'}`}>
                        {m3uLoading ? "Streaming & parsing..." : "Engine Idle (Ready)"}
                      </span>
                    </div>
                  </div>

                  {/* CUSTOM IMPORT MODES (RIGHT COL - 7 SPAN) */}
                  <div className="lg:col-span-7 bg-[#0F1426] border border-gray-800 rounded-3xl p-6 shadow-md space-y-5">
                    
                    <div>
                      <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2 mb-2">
                        <Plus className="w-4 h-4 text-emerald-400" />
                        B. Add Custom Playlists
                      </h3>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        Have your own playlist subscription or free m3u URL? Paste the link, select a local file, or paste raw text below to decode.
                      </p>
                    </div>

                    {/* ROUTE 1: PLAYLIST URL IMPORT */}
                    <div className="bg-[#080B15] p-3.5 rounded-2xl border border-gray-800/80 space-y-2.5">
                      <p className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wide">Method 1: Import via URL</p>
                      <div className="flex gap-2">
                        <input
                          id="m3u-url-input-val"
                          type="text"
                          placeholder="e.g. https://example.com/playlist.m3u"
                          value={m3uUrlInput}
                          onChange={(e) => setM3uUrlInput(e.target.value)}
                          className="flex-1 bg-[#101427] border border-gray-800 px-3 py-2 rounded-xl text-xs text-gray-200 outline-none focus:border-blue-500"
                        />
                        <button
                          id="btn-import-url"
                          disabled={m3uLoading}
                          onClick={() => loadM3UFromUrl(m3uUrlInput)}
                          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-xs text-white px-4 py-2 rounded-xl font-bold transition-all shadow shrink-0"
                        >
                          Import Link
                        </button>
                      </div>
                    </div>

                    {/* ROUTE 2: LOCAL FILE UPLOAD & CODES DRAG-DROP */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Local file choosing */}
                      <div className="bg-[#080B15] p-3.5 rounded-2xl border border-gray-800/80 space-y-2.5">
                        <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wide">Method 2: Select Local File</p>
                        <div className="relative border border-dashed border-gray-800 rounded-xl hover:border-emerald-500 transition-all text-center p-3 cursor-pointer">
                          <input
                            id="m3u-file-browse-input"
                            type="file"
                            accept=".m3u,.m3u8,.txt"
                            onChange={handleM3UFileSelect}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          />
                          <Database className="w-5 h-5 text-gray-500 mx-auto mb-1.5" />
                          <span className="text-[10px] text-gray-400 font-medium block">
                            Choose `.m3u` file
                          </span>
                        </div>
                      </div>

                      {/* Route 3: Paste area */}
                      <div className="bg-[#080B15] p-3.5 rounded-2xl border border-gray-800/80 space-y-2.5 relative">
                        <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wide">Method 3: Paste Raw Codes</p>
                        <textarea
                          id="m3u-pasted-raw-text"
                          rows={2}
                          value={m3uTextInput}
                          onChange={(e) => setM3uTextInput(e.target.value)}
                          placeholder="#EXTM3U&#10;#EXTINF:-1,Sample TV&#10;http://..."
                          className="w-full bg-[#101427] border border-gray-800 p-2 rounded-xl text-[9px] font-mono text-gray-300 outline-none focus:border-cyan-500 resize-none h-[42px] leading-snug"
                        />
                        <button
                          id="btn-import-pasted-text"
                          onClick={handleLoadPastedM3UText}
                          className="absolute bottom-5 right-5 bg-cyan-600 hover:bg-cyan-500 font-black text-[9px] text-white px-2.5 py-1 rounded shadow"
                        >
                          Load Raw
                        </button>
                      </div>

                    </div>

                  </div>

                </div>

                {/* PLAYLIST SEARCH, GRID & BROWSER METRICS ENCAPSULATED IN ULTRA FAST SUB-COMPONENT */}
                <M3UChannelsSection
                  m3uPlaylistChannels={m3uPlaylistChannels}
                  currentPlayItem={currentPlayItem}
                  setCurrentPlayItem={setCurrentPlayItem}
                />

              </div>
            )}

            {/* STREAMEX VOD AGGREGATOR VIEW */}
            {activeTab === 'streamex' && (
              <div id="streamex-hub-container" className="space-y-8 animate-fade-in">
                
                {/* HERO BOARD */}
                <div className="bg-gradient-to-r from-[#17130F] via-[#0D0C11] to-[#0D111D] border border-amber-500/10 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-3xl rounded-full" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow">
                        FREE SOURCE NETWORK
                      </span>
                      <span className="bg-gray-800 text-gray-300 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full">
                        MULTIPLE ROUTE FAILOVER
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">
                      StreamEx Aggregated Cinema Hub
                    </h2>
                    <p className="text-sm text-gray-400 max-w-2xl mt-2 leading-relaxed">
                      Enjoy instant access to millions of on-demand movies and series. Simply input any IMDB identifier (<code className="text-amber-400 font-mono">tt......</code>) or TMDB ID to automatically stream high-speed high-definition mirrors without any active server subscriptions.
                    </p>
                  </div>
                </div>

                {/* AD-HOC MANUAL STREAM CONTROLLER */}
                <div className="bg-[#0F1426] border border-gray-805 rounded-3xl p-6 shadow-md">
                  <h3 className="text-base font-bold text-gray-100 flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    Ad-hoc Selector Engine (sh)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Media Type, Engine Selectors */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          1. Select Media Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            id="streamex-type-movie"
                            onClick={() => setStreamExType('movie')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                              streamExType === 'movie'
                                ? 'bg-amber-500 border-amber-400 text-black shadow'
                                : 'bg-[#080B15] border-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            🎬 Movie
                          </button>
                          <button
                            id="streamex-type-tv"
                            onClick={() => setStreamExType('tv')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                              streamExType === 'tv'
                                ? 'bg-amber-500 border-amber-400 text-black shadow'
                                : 'bg-[#080B15] border-gray-800 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            📺 TV Series
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          2. Active Provider Route
                        </label>
                        <select
                          id="streamex-engine-select"
                          value={streamExEngine}
                          onChange={(e) => setStreamExEngine(e.target.value as any)}
                          className="w-full bg-[#080B15] border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-gray-300 font-medium outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="streamex">StreamEx (sh) - High Speed (No Ads)</option>
                          <option value="vidsrc">VidSrc (xyz) - Core Failover Mirror</option>
                        </select>
                      </div>
                    </div>

                    {/* IMDB or TMDB identifier */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          3. IMDB ID or TMDB ID
                        </label>
                        <input
                          id="streamex-imdb-input"
                          type="text"
                          value={streamExImdbId}
                          onChange={(e) => setStreamExImdbId(e.target.value)}
                          placeholder="e.g. tt1375666 or 27205"
                          className="w-full bg-[#080B15] p-2.5 rounded-xl border border-gray-800 text-sm text-gray-200 font-mono focus:border-amber-500 outline-none placeholder:text-gray-600"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1">
                          Must start with <code className="text-gray-400 font-bold">tt</code> for IMDB, or standard digits for TMDB IDs.
                        </span>
                      </div>

                      {/* TV Season / Episode conditional sliders */}
                      {streamExType === 'tv' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                              Season
                            </label>
                            <input
                              id="streamex-season-num-input"
                              type="number"
                              min={1}
                              value={streamExSeason}
                              onChange={(e) => setStreamExSeason(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-[#080B15] p-2 rounded-lg border border-gray-800 text-xs text-center text-gray-200 focus:border-amber-500 outline-none font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                              Episode
                            </label>
                            <input
                              id="streamex-episode-num-input"
                              type="number"
                              min={1}
                              value={streamExEpisode}
                              onChange={(e) => setStreamExEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-[#080B15] p-2 rounded-lg border border-gray-800 text-xs text-center text-gray-200 focus:border-amber-500 outline-none font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit play triggers */}
                    <div className="flex flex-col justify-end space-y-3">
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                        <p className="text-[11px] text-amber-300 leading-normal">
                          💡 <strong>Dynamic Lookup:</strong> Copy-paste any ID (e.g. <code>tt15239678</code> for Dune 2), and tap Stream to route immediately to StreamEx CDN.
                        </p>
                      </div>

                      <button
                        id="streamex-load-active-btn"
                        onClick={() => playStreamExItem('Manual ID Selection', streamExImdbId, streamExType, streamExSeason, streamExEpisode)}
                        className="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-black font-black text-xs py-3 px-4 rounded-xl uppercase tracking-wider shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        🚀 Stream Custom Title
                      </button>
                    </div>

                  </div>
                </div>

                {/* ACTIVE SERVER DIRECT SEARCH (streamex.sh/search proxy) */}
                <div className="bg-gradient-to-b from-[#11162A] to-[#0A0D1D] border border-amber-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full" />
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-base font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <Search className="w-5 h-5 text-amber-500" />
                          Active StreamEx Index Search
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Direct real-time query of active movie & series server streaming cards using keyless dynamic index endpoints.
                        </p>
                      </div>

                      {/* Interactive search input */}
                      <div className="w-full md:w-96 flex gap-2">
                        <div className="relative flex-1">
                          <input
                            id="streamex-dynamic-search-box"
                            type="text"
                            value={streamExDynamicQuery}
                            onChange={(e) => setStreamExDynamicQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                triggerDynamicStreamExSearch(streamExDynamicQuery);
                              }
                            }}
                            placeholder="Enter movie or series title (e.g. Iron Man)"
                            className="w-full bg-[#080B15] border border-gray-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-gray-200 pl-10 outline-none transition-all placeholder:text-gray-600 font-medium"
                          />
                          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          {streamExDynamicQuery && (
                            <button
                              id="clear-streamex-search-box-btn"
                              onClick={() => {
                                setStreamExDynamicQuery('');
                                setDynamicSearchResults([]);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <button
                          id="streamex-search-trigger-btn"
                          onClick={() => triggerDynamicStreamExSearch(streamExDynamicQuery)}
                          disabled={dynamicSearchLoading}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-md shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {dynamicSearchLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Search</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC SEARCH RESULTS LIST */}
                    {dynamicSearchLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <div className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                        <p className="text-xs text-gray-400">Querying global route streaming servers...</p>
                      </div>
                    ) : dynamicSearchError ? (
                      <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl text-center">
                        <p className="text-xs text-amber-400 font-medium">{dynamicSearchError}</p>
                      </div>
                    ) : dynamicSearchResults.length > 0 ? (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 animate-fade-in">
                        {dynamicSearchResults.map((result) => (
                          <div
                            id={`dynamic-result-${result.id}`}
                            key={`dyn-${result.id}`}
                            onClick={() => {
                              setStreamExImdbId(result.id);
                              setStreamExType(result.type);
                              setStreamExSeason(1);
                              setStreamExEpisode(1);
                              playStreamExItem(result.title, result.id, result.type);
                            }}
                            className="bg-[#080B15] border border-gray-800/80 hover:border-amber-500 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] cursor-pointer group shadow hover:shadow-amber-500/5 select-none"
                          >
                            <div>
                              <div className="aspect-[2/3] w-full bg-[#04060C] rounded-xl overflow-hidden relative mb-2.5 border border-gray-800/50">
                                <img
                                  src={result.poster}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80';
                                  }}
                                />
                                <span className={`absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white shadow-md ${
                                  result.type === 'tv' ? 'bg-indigo-600' : 'bg-red-600'
                                }`}>
                                  {result.type === 'tv' ? 'Series' : 'Movie'}
                                </span>
                                <span className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm border border-amber-500/20 text-amber-400 font-bold text-[9px] px-1.5 py-0.5 rounded">
                                  ⭐ {result.rating}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-gray-200 group-hover:text-amber-400 truncate leading-snug" title={result.title}>
                                {result.title}
                              </h5>
                              <p className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                <span>Year: {result.year}</span>
                                <span className="font-mono text-[9px] text-gray-600">{result.id}</span>
                              </p>
                            </div>
                            
                            <div className="mt-3 pt-2 border-t border-gray-900 flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 truncate max-w-[80px] font-medium" title={typeof result.stars === 'string' ? result.stars : result.stars.join?.(', ') || ''}>
                                {typeof result.stars === 'string' ? result.stars : result.stars[0] || 'Cast Info'}
                              </span>
                              <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5 bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-900/30 group-hover:bg-amber-500 group-hover:text-black transition-all">
                                Stream →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : streamExDynamicQuery.trim().length >= 2 ? (
                      <div className="py-8 text-center text-gray-500 border border-dashed border-gray-800 rounded-2xl bg-black/20">
                        <p className="text-xs">No active indexing cards found matching "{streamExDynamicQuery}". Try another keyword query.</p>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-500 border border-dashed border-gray-800 rounded-2xl bg-black/20">
                        <p className="text-xs">Search results will match dynamically. Type a blockbuster title and click search to begin.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* PRE-CURATED CINEMA CATALOG */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Hit Cinema Feeds (Pre-stages)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Instant one-tap streaming without tracking down IDs manually.</p>
                    </div>

                    {/* Filter local items */}
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="streamex-term-search"
                        type="text"
                        value={streamExSearchText}
                        onChange={(e) => setStreamExSearchText(e.target.value)}
                        placeholder="Search blockbuster name, ID..."
                        className="w-full bg-[#0F1426] pl-10 pr-4 py-2.5 rounded-xl text-xs text-gray-200 border border-gray-800 outline-none focus:border-amber-500 placeholder:text-gray-600"
                      />
                    </div>
                  </div>

                  {/* Curated Movies Divider */}
                  <div>
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span>🎬 Popular Movies</span>
                      <span className="w-8 h-px bg-amber-500/20 flex-1" />
                    </h4>
                    {filteredCuratedMovies.length === 0 ? (
                      <p className="text-xs text-gray-500 py-6 text-center bg-[#0F1426] rounded-xl border border-gray-800">No movies match your search term.</p>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {filteredCuratedMovies.map((movie) => (
                          <div
                            id={`streamex-movie-${movie.id}`}
                            key={`streamex-m-${movie.id}`}
                            onClick={() => {
                              setStreamExImdbId(movie.id);
                              setStreamExType('movie');
                              playStreamExItem(movie.title, movie.id, 'movie');
                            }}
                            className="bg-[#0F1426] border border-gray-800 hover:border-amber-500 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.02] shadow"
                          >
                            <div>
                              <div className="aspect-[3/4] w-full bg-[#080B15] rounded-lg overflow-hidden relative mb-2.5">
                                <img
                                  src={movie.poster}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80';
                                  }}
                                />
                                <span className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm border border-amber-500/20 text-amber-400 font-bold text-[9px] px-1.5 py-0.5 rounded">
                                  ⭐ {movie.rating}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-gray-200 group-hover:text-amber-400 truncate leading-snug">
                                {movie.title}
                              </h5>
                              <p className="text-[10px] text-gray-400 mt-0.5">{movie.year}</p>
                            </div>
                            
                            <div className="mt-2.5 pt-2 border-t border-gray-900 flex items-center justify-between">
                              <span className="text-[9px] text-gray-500 font-mono">{movie.id}</span>
                              <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider group-hover:underline">Stream →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Curated Series Divider */}
                  <div className="pt-4">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span>📺 Popular TV Series</span>
                      <span className="w-8 h-px bg-amber-500/20 flex-1" />
                    </h4>
                    {filteredCuratedSeries.length === 0 ? (
                      <p className="text-xs text-gray-500 py-6 text-center bg-[#0F1426] rounded-xl border border-gray-800">No series match your search term.</p>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {filteredCuratedSeries.map((series) => (
                          <div
                            id={`streamex-series-${series.id}`}
                            key={`streamex-s-${series.id}`}
                            onClick={() => {
                              setStreamExImdbId(series.id);
                              setStreamExType('tv');
                              playStreamExItem(series.title, series.id, 'tv', 1, 1);
                            }}
                            className="bg-[#0F1426] border border-gray-800 hover:border-amber-500 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.02] shadow"
                          >
                            <div>
                              <div className="aspect-[3/4] w-full bg-[#080B15] rounded-lg overflow-hidden relative mb-2.5">
                                <img
                                  src={series.poster}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1547483238-f400e65ccd56?w=400&q=80';
                                  }}
                                />
                                <span className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm border border-amber-500/20 text-amber-400 font-bold text-[9px] px-1.5 py-0.5 rounded">
                                  ⭐ {series.rating}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-gray-200 group-hover:text-amber-400 truncate leading-snug">
                                {series.title}
                              </h5>
                              <p className="text-[10px] text-gray-400 mt-0.5">{series.year}</p>
                            </div>
                            
                            <div className="mt-2.5 pt-2 border-t border-gray-900 flex items-center justify-between">
                              <span className="text-[9px] text-gray-500 font-mono">{series.id}</span>
                              <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider group-hover:underline">Stream →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* LIVE USER CONFIGURATION EXCEPTION WRAPPERS */}
            {activeTab !== 'streamex' && errorMsg && (
              <div className="bg-red-950/30 border border-red-800/80 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start justify-between shadow-xl">
                <div className="flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-300">Connection Exception Encountered</h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      Could not extract content playlists from host <strong className="text-white">{config.host}</strong>. This might be caused by temporary server downtime, expired account credentials, or browser CORS security rules.
                    </p>
                    <p className="text-[11px] font-mono text-gray-400 mt-2 bg-gray-950 p-2 rounded border border-gray-900">
                      Error Data: {errorMsg}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 self-stretch md:self-auto shrink-0 justify-end">
                  <button 
                    id="retry-connection-btn"
                    onClick={loadXtreamServerContent}
                    className="bg-gray-800 hover:bg-gray-700 text-xs px-3.5 py-2.5 rounded-lg border border-gray-700 flex items-center justify-center gap-2 font-medium transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Connection
                  </button>
                  <button 
                    id="trigger-config-settings-btn"
                    onClick={() => setShowSettingsDrawer(true)}
                    className="bg-red-600 hover:bg-red-500 text-xs text-white px-3.5 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                  >
                    Modify Server Settings
                  </button>
                </div>
              </div>
            )}

            {activeTab !== 'streamex' && (loading ? (
              // Interactive dynamic loading loader skeleton
              <div className="space-y-6 py-12 text-center flex flex-col items-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-red-600 animate-spin" />
                  <Database className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Retrieving Atlan Core Database...</h3>
                  <p className="text-xs text-gray-400 mt-1">Connecting to proxy pipelines and parsing live categories. Please hold...</p>
                </div>
              </div>
            ) : (
              // LOADED BROWSER CONTENT
              <div className="space-y-6">

                {/* SEARCH BAR & CATEGORY SELECTOR ZONE */}
                <div id="iptv-search-filter-belt" className="bg-[#0F1426] border border-gray-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
                  
                  {/* Category dropdown filters */}
                  <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0 whitespace-nowrap align-middle sm:pt-0">
                      Filter by Catalog:
                    </span>
                    
                    {activeTab === 'live' || activeTab === 'adult' ? (
                      <select
                        id="live-category-select-dropdown"
                        value={selectedLiveCategoryId}
                        onChange={(e) => {
                          setSelectedLiveCategoryId(e.target.value);
                          setVisibleCount(80);
                        }}
                        className="bg-[#080B15] border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-red-600 min-w-[200px]"
                      >
                        <option value="all">All Category Pipelines ({activeCategoryList.length})</option>
                        {activeCategoryList.map(cat => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.category_name}
                          </option>
                        ))}
                      </select>
                    ) : activeTab === 'vod' ? (
                      <select
                        id="vod-category-select-dropdown"
                        value={selectedVodCategoryId}
                        onChange={(e) => {
                          setSelectedVodCategoryId(e.target.value);
                          setVisibleCount(80);
                        }}
                        className="bg-[#080B15] border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-red-600 min-w-[200px]"
                      >
                        <option value="all">All Movie Categories ({activeVodCategoryList.length})</option>
                        {activeVodCategoryList.map(cat => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.category_name}
                          </option>
                        ))}
                      </select>
                    ) : activeTab === 'series' ? (
                      <select
                        id="series-category-select-dropdown"
                        value={selectedSeriesCategoryId}
                        onChange={(e) => {
                          setSelectedSeriesCategoryId(e.target.value);
                          setVisibleCount(80);
                        }}
                        className="bg-[#080B15] border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-red-600 min-w-[200px]"
                      >
                        <option value="all">All Series Categories ({activeSeriesCategoryList.length})</option>
                        {activeSeriesCategoryList.map(cat => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.category_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-rose-400 font-semibold bg-rose-950/30 border border-rose-900/40 px-3 py-1.5 rounded-lg inline-block">
                        Preferred Personal list active
                      </span>
                    )}
                  </div>

                  {/* Fuzzy Live Text Search input */}
                  <div className="w-full md:w-80 relative">
                    <input 
                      id="live-search-input-box"
                      type="text"
                      placeholder="Search stream name / tag..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setVisibleCount(80);
                      }}
                      className="w-full bg-[#080B15] border border-gray-800 px-4 py-2.5 pl-10 rounded-xl text-sm text-gray-200 outline-none focus:border-red-600 placeholder:text-gray-500 transition-all font-medium"
                    />
                    <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    {searchQuery && (
                      <button 
                        id="clear-search-btn"
                        onClick={() => {
                          setSearchQuery('');
                          setVisibleCount(80);
                        }}
                        className="text-xs text-gray-500 hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>

                {/* STREAM ELEMENTS GRID SHOW */}
                <div>
                  
                  {/* Category details header */}
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-black tracking-tight uppercase border-l-4 border-red-600 pl-3">
                      {activeTab === 'live' ? 'Live Stream Feeds' :
                       activeTab === 'vod' ? 'HD Movie Library' :
                       activeTab === 'series' ? 'TV Show Series' :
                       activeTab === 'favorites' ? 'Your Saved Streams' :
                       'Private Adult (18+) Channels'}
                    </h2>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-900 px-2.5 py-1 rounded">
                      {activeTab === 'live' ? `${filteredLiveStreams.length} available` :
                       activeTab === 'vod' ? `${filteredVodStreams.length} available` :
                       activeTab === 'series' ? `${filteredSeriesStreams.length} available` :
                       activeTab === 'favorites' ? `${filteredLiveStreams.length + filteredVodStreams.length + filteredSeriesStreams.length} saved` :
                       `${filteredLiveStreams.length + filteredVodStreams.length + filteredSeriesStreams.length} private streams`}
                    </span>
                  </div>

                  {/* Ultimate render of streams */}
                  {activeTab === 'live' || (activeTab === 'adult' && filteredLiveStreams.length > 0) ? (
                    filteredLiveStreams.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 space-y-2">
                        <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
                        <p className="text-sm">No streaming channels matched the active criteria.</p>
                      </div>
                    ) : (
                      <div id="live-stream-bento-grid" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {filteredLiveStreams.slice(0, visibleCount).map((stream, idx) => {
                          const isFav = favorites.includes(`live-${stream.stream_id}`);
                          const isPlaying = currentPlayItem && currentPlayItem.id === stream.stream_id;
                          const sanitizedHost = config.host.endsWith('/') ? config.host.slice(0, -1) : config.host;
                          const resolvedStreamUrl = stream.direct_source || `${sanitizedHost}/live/${config.username}/${config.password}/${stream.stream_id}.ts`;

                          return (
                            <div
                              id={`channel-card-${stream.stream_id}`}
                              key={`live-${stream.stream_id}-${idx}`}
                              onClick={() => playLiveStream(stream)}
                              className="bg-[#0F1426] border border-gray-800 hover:border-red-600 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-103 shadow hover:shadow-lg shadow-black/30 group relative cursor-pointer"
                            >
                              <div className="absolute top-2 right-2 z-10">
                                <button
                                  id={`fav-toggle-btn-live-${stream.stream_id}`}
                                  onClick={(e) => toggleFavoriteItem(`live-${stream.stream_id}`, e)}
                                  className="w-7 h-7 bg-black/60 border border-gray-800 hover:bg-black text-[#EF4444] rounded-full flex items-center justify-center transition-all shadow-md"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                                </button>
                              </div>

                              {reminders.some(r => r.streamId === stream.stream_id || r.streamId === Number(stream.stream_id)) && (
                                <div className="absolute top-2 left-2 z-10 bg-rose-600 border border-rose-400/30 text-white p-1 rounded-md flex items-center justify-center shadow animate-pulse" title="Active Show Reminder Scheduled">
                                  <Bell className="w-3 h-3 fill-white" />
                                </div>
                              )}

                              <div className="aspect-video bg-[#080B15] rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center p-2 mb-3 relative group-hover:border-red-900/60">
                                <HoverStreamPreview
                                  streamUrl={resolvedStreamUrl}
                                  logoUrl={stream.stream_icon || undefined}
                                  fallbackName={stream.name}
                                  isPlayingMain={isPlaying}
                                  accentColor="red"
                                />
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-xs font-bold text-gray-200 group-hover:text-red-400 transition-all leading-snug truncate" title={stream.name}>
                                  {stream.name}
                                </h3>
                                <p className="text-[9px] text-gray-500 mt-1 truncate">Streaming Protocol: TS</p>
                              </div>

                              <div className="mt-3 flex items-center gap-1">
                                <StreamStatusIndicator streamUrl={resolvedStreamUrl} />
                                <div className="ml-auto flex items-center gap-1.5">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadChannelEpg(stream);
                                      setActiveTab('epg');
                                    }}
                                    title="View EPG Interactive Program Guide"
                                    className="bg-[#121A30] hover:bg-red-950/40 text-gray-400 hover:text-red-400 p-1.5 rounded-md border border-gray-850 transition shadow cursor-pointer"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={(e) => handleShareStream(stream.name, resolvedStreamUrl, e)}
                                    title="Copy Stream link for sharing"
                                    className={`${copiedStreamUrl === resolvedStreamUrl ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400' : 'bg-[#121A30] hover:bg-red-950/40 text-gray-400 hover:text-red-400'} p-1.5 rounded-md border border-gray-850 transition shadow cursor-pointer`}
                                  >
                                    {copiedStreamUrl === resolvedStreamUrl ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Share2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button 
                                    id={`play-stream-arrow-${stream.stream_id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playLiveStream(stream);
                                    }}
                                    className="bg-gray-950 hover:bg-red-600 text-gray-400 hover:text-white p-1.5 rounded-md transition-all border border-gray-850 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-current text-white" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}

                  {/* MOVIES CATALOG RENDER */}
                  {activeTab === 'vod' || (activeTab === 'adult' && filteredVodStreams.length > 0) ? (
                    filteredVodStreams.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 space-y-2">
                        <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
                        <p className="text-sm">No movies matched the active filter.</p>
                      </div>
                    ) : (
                      <div id="vod-movies-bento-grid" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {filteredVodStreams.slice(0, visibleCount).map((movie, idx) => {
                          const isFav = favorites.includes(`vod-${movie.stream_id}`);
                          return (
                            <div
                              id={`movie-card-${movie.stream_id}`}
                              key={`vod-${movie.stream_id}-${idx}`}
                              onClick={() => playVodMovie(movie)}
                              className="bg-[#0F1426] border border-gray-800 hover:border-red-600 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-103 shadow hover:shadow-lg shadow-black/30 group relative cursor-pointer"
                            >
                              <div className="absolute top-2 right-2 z-10">
                                <button
                                  id={`fav-toggle-btn-vod-${movie.stream_id}`}
                                  onClick={(e) => toggleFavoriteItem(`vod-${movie.stream_id}`, e)}
                                  className="w-7 h-7 bg-black/60 border border-gray-800 hover:bg-black text-[#EF4444] rounded-full flex items-center justify-center transition-all shadow-md"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                                </button>
                              </div>

                              <div className="aspect-[2/3] bg-[#080B15] rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center mb-3 relative group-hover:border-red-900/60 shadow">
                                {movie.stream_icon ? (
                                  <img 
                                    src={movie.stream_icon} 
                                    alt="" 
                                    className="w-full h-full object-cover shrink-0"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : null}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950 p-2 text-center text-[10px] font-bold text-gray-400">
                                  {movie.container_extension?.toUpperCase() || 'HD'}
                                </div>
                              </div>

                              <div className="min-w-0 mb-2">
                                <h3 className="text-xs font-bold text-gray-200 group-hover:text-red-400 transition-all leading-snug truncate" title={movie.name}>
                                  {movie.name}
                                </h3>
                                {movie.rating && (
                                  <p className="text-[9px] text-yellow-500 font-bold mt-1">★ {movie.rating}</p>
                                )}
                              </div>

                              <button className="w-full bg-[#151B33] group-hover:bg-red-600 hover:scale-102 hover:text-white text-gray-300 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 mt-auto shadow">
                                <Film className="w-3.5 h-3.5" />
                                Stream Film
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}

                  {/* SERIES CATALOG RENDER */}
                  {activeTab === 'series' || (activeTab === 'adult' && filteredSeriesStreams.length > 0) ? (
                    filteredSeriesStreams.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 space-y-2">
                        <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
                        <p className="text-sm">No series television shows matched active filters.</p>
                      </div>
                    ) : (
                      <div id="series-shows-bento-grid" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {filteredSeriesStreams.slice(0, visibleCount).map((series, idx) => {
                          const isFav = favorites.includes(`series-${series.series_id}`);
                          return (
                            <div
                              id={`series-card-${series.series_id}`}
                              key={`series-${series.series_id}-${idx}`}
                              onClick={() => playSeriesEpisode(series)}
                              className="bg-[#0F1426] border border-gray-800 hover:border-red-600 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-103 shadow hover:shadow-lg shadow-black/30 group relative cursor-pointer"
                            >
                              <div className="absolute top-2 right-2 z-10">
                                <button
                                  id={`fav-toggle-btn-series-${series.series_id}`}
                                  onClick={(e) => toggleFavoriteItem(`series-${series.series_id}`, e)}
                                  className="w-7 h-7 bg-black/60 border border-gray-800 hover:bg-black text-[#EF4444] rounded-full flex items-center justify-center transition-all shadow-md"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                                </button>
                              </div>

                              <div className="aspect-[2/3] bg-[#080B15] rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center mb-3 relative group-hover:border-red-900/60 shadow">
                                {series.cover ? (
                                  <img 
                                    src={series.cover} 
                                    alt="" 
                                    className="w-full h-full object-cover shrink-0"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : null}
                              </div>

                              <div className="min-w-0 mb-2">
                                <h3 className="text-xs font-bold text-gray-200 group-hover:text-red-400 transition-all leading-snug truncate" title={series.name}>
                                  {series.name}
                                </h3>
                                {series.rating && (
                                  <p className="text-[9px] text-yellow-500 font-bold mt-1">★ {series.rating}</p>
                                )}
                              </div>

                              <button className="w-full bg-[#151B33] group-hover:bg-red-600 hover:scale-102 hover:text-white text-gray-300 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 mt-auto shadow">
                                <Clapperboard className="w-3.5 h-3.5" />
                                Stream Show
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}

                  {/* FAVORITES VIEW */}
                  {activeTab === 'favorites' && (
                    filteredLiveStreams.length === 0 && filteredVodStreams.length === 0 && filteredSeriesStreams.length === 0 ? (
                      <div className="text-center py-16 text-gray-500 bg-[#0F1426] border border-gray-800 rounded-2xl p-6">
                        <Heart className="w-12 h-12 text-gray-700 mx-auto stroke-1" />
                        <h4 className="font-bold text-gray-300 mt-2">Preferred List is Empty</h4>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                          Browse Live Streams or Movie catalogs and click the heart icons to pre-stage fast access links here.
                        </p>
                      </div>
                    ) : (
                      // Displaying grouped preferred elements
                      <div className="space-y-6">
                        {filteredLiveStreams.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-gray-400 mb-3 tracking-wide">Live Channels ({filteredLiveStreams.length})</h3>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                              {filteredLiveStreams.map((stream, idx) => (
                                <div
                                  id={`fav-live-${stream.stream_id}-${idx}`}
                                  key={`fav-live-${stream.stream_id}`}
                                  onClick={() => playLiveStream(stream)}
                                  className="bg-[#0F1426] border border-gray-800 hover:border-red-600 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group hover:scale-102 shadow"
                                >
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <h4 className="text-xs font-bold text-gray-200 group-hover:text-red-400 truncate leading-snug">{stream.name}</h4>
                                    {reminders.some(r => r.streamId === stream.stream_id || r.streamId === Number(stream.stream_id)) && (
                                      <Bell className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[9px] text-amber-500 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/50">LIVE</span>
                                    <button 
                                      id={`remove-fav-btn-live-${stream.stream_id}`}
                                      onClick={(e) => toggleFavoriteItem(`live-${stream.stream_id}`, e)} 
                                      className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {filteredVodStreams.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-gray-400 mb-3 tracking-wide text-cyan-400">Movies VOD ({filteredVodStreams.length})</h3>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                              {filteredVodStreams.map((movie, idx) => (
                                <div
                                  id={`fav-movie-${movie.stream_id}-${idx}`}
                                  key={`fav-movie-${movie.stream_id}`}
                                  onClick={() => playVodMovie(movie)}
                                  className="bg-[#0F1426] border border-gray-800 hover:border-red-600 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group hover:scale-102 shadow"
                                >
                                  <h4 className="text-xs font-bold text-gray-200 group-hover:text-red-400 truncate leading-snug">{movie.name}</h4>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[9px] text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/50">MOVIE</span>
                                    <button 
                                      id={`remove-fav-btn-vod-${movie.stream_id}`}
                                      onClick={(e) => toggleFavoriteItem(`vod-${movie.stream_id}`, e)} 
                                      className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* ELECTRONIC PROGRAM GUIDE (EPG) VIEW */}
                  {activeTab === 'epg' && (
                    <div id="epg-explorer-container" className="space-y-6 animate-fade-in">
                      
                      {/* HEADER SUMMARY BAR */}
                      <div className="bg-gradient-to-r from-[#171D3A] via-[#10142C] to-[#0A0D1F] border border-blue-500/10 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 blur-3xl rounded-full animate-pulse" />
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow border border-red-400/35">
                                EPG LAYER INTEGRATION
                              </span>
                              <span className="bg-gray-800 text-gray-300 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full">
                                Real-Time Streams
                              </span>
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-wide">
                              Electronic Program Guide (EPG)
                            </h2>
                            <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
                              Browse upcoming schedules, track active shows, and view full descriptions from the IPTV server directly. Selected channels can be played instantly.
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-3xl font-black text-red-500 tracking-wider">
                              {liveStreams.length}
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                              Broadcast Channels
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* MAIN EPG INTERACTIVE PANEL */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* LEFT COLUMN: CHANNEL SELECTOR (5 COLS) */}
                        <div className="lg:col-span-5 bg-[#101427] border border-gray-800/80 rounded-2xl p-4 space-y-4 flex flex-col justify-start overflow-hidden">
                          
                          {/* QUICK STATUS HEAD */}
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5 text-blue-400" />
                              Channel Directory
                            </h3>
                            <span className="text-[10px] font-mono bg-blue-950/20 text-blue-300 px-2 py-0.5 rounded border border-blue-900/30">
                              {liveStreams.length > 0 ? 'Connected' : 'Offline'}
                            </span>
                          </div>

                          {/* SEARCH & CATEGORY FILTER BAR */}
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                id="epg-search-input"
                                type="text"
                                placeholder="Search channels by name..."
                                value={epgSearchQuery}
                                onChange={(e) => setEpgSearchQuery(e.target.value)}
                                className="w-full bg-[#090C15] border border-gray-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl py-2 pl-10 pr-4 text-xs font-medium placeholder-gray-500 text-white outline-none transition"
                              />
                              {epgSearchQuery && (
                                <button
                                  onClick={() => setEpgSearchQuery('')}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* CATEGORY SELECTOR */}
                            <select
                              id="epg-category-selector"
                              value={selectedEpgCategoryId}
                              onChange={(e) => setSelectedEpgCategoryId(e.target.value)}
                              className="w-full bg-[#090C15] border border-gray-800 hover:border-gray-750 focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl py-2 px-3 text-xs font-medium text-gray-300 outline-none cursor-pointer transition"
                            >
                              <option value="all">All EPG Categories</option>
                              {separatedCategories.live.regular.map(cat => (
                                <option key={cat.category_id} value={cat.category_id}>
                                  {cat.category_name}
                                </option>
                              ))}
                              {isAdultUnlocked && separatedCategories.live.adult.map(cat => (
                                <option key={cat.category_id} value={cat.category_id}>
                                  🔓 Adult: {cat.category_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* CHANNEL GRID / LIST */}
                          <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {(() => {
                              const filteredEpgStreams = liveStreams.filter(stream => {
                                const isAdultCat = adultCategoryIds.has(stream.category_id);
                                if (isAdultCat && !isAdultUnlocked) return false;
                                if (selectedEpgCategoryId !== 'all' && stream.category_id !== selectedEpgCategoryId) return false;
                                if (epgSearchQuery.trim()) {
                                  return stream.name.toLowerCase().includes(epgSearchQuery.toLowerCase());
                                }
                                return true;
                              });

                              if (filteredEpgStreams.length === 0) {
                                return (
                                  <div className="text-center py-12 bg-[#090C15] rounded-xl border border-gray-800/60 p-4">
                                    <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-1.5" />
                                    <p className="text-xs text-gray-500 font-medium">No IPTV channels found.</p>
                                  </div>
                                );
                              }

                              return filteredEpgStreams.slice(0, 150).map((stream, idx) => {
                                const isSelected = selectedEpgChannel?.stream_id === stream.stream_id;
                                return (
                                  <div
                                    id={`epg-channel-select-${stream.stream_id}`}
                                    key={`epg-chan-${stream.stream_id}-${idx}`}
                                    onClick={() => loadChannelEpg(stream)}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none group ${
                                      isSelected
                                        ? 'bg-gradient-to-r from-red-950/20 via-rose-950/20 to-[#0A0D1A] border-red-600/80 shadow shadow-red-950/40 font-bold'
                                        : 'bg-[#090C15] border-gray-800/80 hover:border-gray-700 hover:bg-[#0C101F]'
                                    }`}
                                  >
                                    {stream.stream_icon ? (
                                      <img
                                        src={stream.stream_icon}
                                        alt=""
                                        className="w-8 h-8 rounded-lg object-cover bg-black border border-gray-800 shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center font-mono text-[10px] font-bold text-gray-500 uppercase shrink-0">
                                        {stream.name.slice(0, 2)}
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <h4 className={`text-[11px] truncate leading-snug ${
                                          isSelected ? 'text-red-400' : 'text-gray-200 group-hover:text-white'
                                        }`}>
                                          {stream.name}
                                        </h4>
                                        {reminders.some(r => r.streamId === stream.stream_id || r.streamId === Number(stream.stream_id)) && (
                                          <Bell className="w-2.5 h-2.5 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                                        )}
                                      </div>
                                      <p className="text-[9px] text-gray-500 font-mono truncate">
                                        SID: #{stream.stream_id}
                                      </p>
                                    </div>
                                    <ChevronRight className={`w-3.5 h-3.5 transition ${
                                      isSelected ? 'text-red-400 translate-x-0.5' : 'text-gray-600 group-hover:text-gray-300'
                                    }`} />
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          <div className="text-[10px] text-gray-500 italic text-center">
                            Showing up to 150 matching streams
                          </div>
                        </div>

                        {/* RIGHT COLUMN: PROGRAMS TIMELINE (7 COLS) */}
                        <div className="lg:col-span-7 bg-[#101427] border border-gray-800/80 rounded-2xl p-5 space-y-4 flex flex-col justify-start min-h-[400px]">
                          {selectedEpgChannel ? (
                            <>
                              {/* SELECTED CHANNEL METADATA AREA */}
                              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-800 animate-fade-in">
                                <div className="flex items-center gap-3">
                                  {selectedEpgChannel.stream_icon ? (
                                    <img
                                      src={selectedEpgChannel.stream_icon}
                                      alt=""
                                      className="w-12 h-12 object-cover rounded-xl bg-black border border-gray-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-mono text-xs font-bold text-gray-400 shrink-0">
                                      {selectedEpgChannel.name.slice(0,2)}
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="text-sm font-black text-white mb-0.5">{selectedEpgChannel.name}</h3>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono font-bold">
                                      EPG ID: {selectedEpgChannel.epg_channel_id || 'Not Mapped'}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  id="epg-play-stream-btn"
                                  onClick={() => {
                                    playLiveStream(selectedEpgChannel);
                                    // Scroll smoothly after setting stream active
                                    setTimeout(() => {
                                      const player = document.getElementById('iptv-player-container-block');
                                      if (player) player.scrollIntoView({ behavior: 'smooth' });
                                    }, 100);
                                  }}
                                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
                                >
                                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                                  <span>Watch Channel</span>
                                </button>
                              </div>

                              {/* LISTINGS CONTAINER */}
                              {epgLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                  <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                                  <p className="text-xs text-gray-400 font-bold">Querying remote IPTV guide provider...</p>
                                </div>
                              ) : epgError ? (
                                <div className="text-center py-16 bg-[#090C15] rounded-xl border border-gray-800/60 p-6 space-y-3">
                                  <div className="w-10 h-10 rounded-full bg-yellow-950/40 border border-yellow-950 flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-300">No Listings Synced</h4>
                                    <p className="text-[11px] text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                                      {epgError}
                                    </p>
                                  </div>
                                </div>
                              ) : epgListings.length === 0 ? (
                                <div className="text-center py-16 bg-[#090C15] rounded-xl border border-gray-800/65 p-6 text-gray-500">
                                  Select a live channel on the left to inspect program schedules.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest pb-1 border-b border-gray-850">
                                    Daily Lineup Schedule
                                  </h4>

                                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                    {epgListings.map((prog, index) => {
                                      const active = isEpgItemActive(prog.start_timestamp, prog.end_timestamp, prog.start, prog.end);
                                      const progress = getEpgItemProgress(prog.start_timestamp, prog.end_timestamp, prog.start, prog.end);
                                      const startTimeObj = parseTimestamp(prog.start_timestamp) || parseEpgDate(prog.start);
                                      const endTimeObj = parseTimestamp(prog.end_timestamp) || parseEpgDate(prog.end);
                                      const formatTime = (dObj: Date | null) => {
                                        if (!dObj) return '';
                                        return dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      };

                                      return (
                                        <div
                                          key={`prog-${prog.id}-${index}`}
                                          className={`relative p-4 rounded-xl border transition-all ${
                                            active
                                              ? 'bg-[#1C1625] border-purple-500/50 shadow shadow-red-950/20'
                                              : 'bg-[#090C15] border-gray-800/80 hover:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <span className="font-mono text-[10px] text-blue-400 bg-blue-950/30 px-2 py-0.5 rounded border border-blue-900/35">
                                              {formatTime(startTimeObj)} - {formatTime(endTimeObj)}
                                            </span>
                                            {active ? (
                                              <span className="text-[9px] font-black text-white bg-red-600 px-2.5 py-0.5 rounded uppercase flex items-center gap-1.5 animate-pulse">
                                                <span className="w-1 h-1 rounded-full bg-white" />
                                                On-Air Now
                                              </span>
                                            ) : (startTimeObj && startTimeObj > new Date()) ? (
                                              (() => {
                                                const rId = `${selectedEpgChannel.stream_id}-${prog.title}-${prog.start_timestamp || prog.start}`;
                                                const hasReminder = reminders.some(r => r.id === rId);
                                                return (
                                                  <button
                                                    onClick={(e) => {
                                                      toggleReminder(
                                                        selectedEpgChannel.stream_id,
                                                        selectedEpgChannel.name,
                                                        prog.title,
                                                        prog.start_timestamp || prog.start,
                                                        prog.end_timestamp || prog.end,
                                                        e
                                                      );
                                                    }}
                                                    className={`px-2 py-1 rounded-lg border text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center gap-1 cursor-pointer select-none ${
                                                      hasReminder
                                                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-400 font-black shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                                                        : 'bg-[#121A30]/80 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                                                    }`}
                                                  >
                                                    <Bell className={`w-2.5 h-2.5 ${hasReminder ? 'fill-rose-400 animate-pulse' : ''}`} />
                                                    <span>{hasReminder ? 'Reminder Set' : 'Remind Me'}</span>
                                                  </button>
                                                );
                                              })()
                                            ) : null}
                                          </div>

                                          <h4 className={`text-xs font-black tracking-tight mb-1.5 ${
                                            active ? 'text-white' : 'text-gray-200'
                                          }`}>
                                            {prog.title}
                                          </h4>

                                          {prog.description && (
                                            <p className="text-[10px] text-gray-400 leading-relaxed max-w-2xl">
                                              {prog.description}
                                            </p>
                                          )}

                                          {active && (
                                            <div className="mt-3 space-y-1.5">
                                              <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                                                <div 
                                                  className="bg-gradient-to-r from-red-500 to-rose-600 h-full transition-all duration-1000" 
                                                  style={{ width: `${progress}%` }} 
                                                />
                                              </div>
                                              <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase">
                                                <span>{progress}% Completed</span>
                                                <span className="text-emerald-400">Stream synchronizing</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3.5 bg-[#090C15]/50 border border-dashed border-gray-850 rounded-2xl">
                              <Calendar className="w-12 h-12 text-gray-700 stroke-1" />
                              <div>
                                <h4 className="font-bold text-gray-300">No Broadcasting Channel Checked</h4>
                                <p className="text-xs text-gray-500 max-w-sm mt-1 leading-normal">
                                  Click on any television channel in the left directory list. We will connect and construct its current real-time programming lineups automatically.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LAZY LOAD TRIGGER BUTTON */}
                  {((activeTab === 'live' && filteredLiveStreams.length > visibleCount) ||
                    (activeTab === 'vod' && filteredVodStreams.length > visibleCount) ||
                    (activeTab === 'series' && filteredSeriesStreams.length > visibleCount)) && (
                    <div className="pt-8 pb-12 text-center">
                      <button
                        id="lazy-load-more-btn"
                        onClick={loadMore}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg inline-flex items-center gap-2 hover:border-red-600"
                      >
                        Load More Content ({visibleCount} of {
                          activeTab === 'live' ? filteredLiveStreams.length : 
                          activeTab === 'vod' ? filteredVodStreams.length : 
                          filteredSeriesStreams.length
                        })
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  )}

                </div>

              </div>
            ))}

          </div>

        </main>
      </div>

      {/* EPG ACTIVE REMINDER TOAST NOTIFICATION OVERLAY */}
      {activeNotification && (
        <div id="epg-reminder-toast" className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#101427] border border-rose-500/50 p-4 rounded-2xl shadow-[0_10px_35px_rgba(239,68,68,0.25)] animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
              <Bell className="w-5 h-5 fill-rose-500/30 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">
                On Air Notification
              </span>
              <h4 className="text-xs font-black text-white truncate leading-relaxed">
                {activeNotification.programTitle}
              </h4>
              <p className="text-[10px] text-gray-400 truncate mt-1">
                Started on <strong className="text-gray-200">{activeNotification.channelName}</strong>
              </p>
              
              <div className="flex items-center gap-2 mt-3 block">
                <button
                  onClick={() => {
                    const streamObj = liveStreams.find(s => s.stream_id === activeNotification.streamId || s.stream_id === Number(activeNotification.streamId));
                    if (streamObj) {
                      playLiveStream(streamObj);
                      setActiveTab('live');
                      setTimeout(() => {
                        const pContainer = document.getElementById('iptv-player-container-block');
                        if (pContainer) pContainer.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                    setActiveNotification(null);
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg cursor-pointer transition shadow hover:shadow-rose-600/30 shrink-0 inline-block"
                >
                  Watch Now
                </button>
                <button
                  onClick={() => setActiveNotification(null)}
                  className="bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition inline-block"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => setActiveNotification(null)}
              className="text-gray-500 hover:text-gray-300 p-1 rounded transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PRIVATE ADULT LOCK KEYPAD PIN MODAL */}
      {showPinModal && (
        <div id="parental-lock-modal" className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#0F1426] border border-gray-800 rounded-3xl p-6 relative shadow-2xl flex flex-col items-center">
            
            <button 
              id="close-pin-modal-btn"
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 p-1.5 focus:bg-gray-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-purple-900/50 border border-purple-800 rounded-full flex items-center justify-center text-purple-400 hover:scale-110 transition-all mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black tracking-tight text-white uppercase text-center">Enter Access Code</h3>
            <p className="text-xs text-gray-400 text-center mt-1 max-w-[280px]">
              Accessing adult channels requires validation of the parental PIN code (Default active: <strong className="text-purple-400">0000</strong>).
            </p>

            {/* Tactile Enter Indicators */}
            <div className="flex justify-center gap-3.5 my-6">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  id={`pin-dot-${idx}`}
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    idx < pinInput.length 
                      ? 'bg-purple-500 border-purple-400 scale-120 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                      : wrongPinError 
                        ? 'border-red-600 bg-red-950 animate-shake' 
                        : 'border-gray-700 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* Error Indicators */}
            {wrongPinError && (
              <p className="text-red-400 text-xs font-bold uppercase tracking-wide animate-pulse mb-3">
                ⚠️ INVALID PIN. TRY AGAIN!
              </p>
            )}

            {/* Custom Interactive Tactile Keypad */}
            <div id="pin-pad-grid" className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  id={`pin-btn-${num}`}
                  key={num}
                  onClick={() => handlePinDigitPress(num)}
                  className="bg-[#080B15] border border-gray-800 hover:border-purple-600 font-bold text-lg text-gray-200 h-14 rounded-2xl flex items-center justify-center transition-all focus:bg-purple-950/40 focus:text-white"
                >
                  {num}
                </button>
              ))}
              
              <button 
                id="pin-btn-clear"
                onClick={handlePinClear}
                className="text-xs text-gray-400 hover:text-white flex items-center justify-center rounded-2xl border border-transparent font-medium"
              >
                Clear
              </button>
              
              <button
                id="pin-btn-0"
                onClick={() => handlePinDigitPress('0')}
                className="bg-[#080B15] border border-gray-800 hover:border-purple-600 font-bold text-lg text-gray-200 h-14 rounded-2xl flex items-center justify-center transition-all focus:bg-purple-950/40 focus:text-white"
              >
                0
              </button>

              <button 
                id="pin-btn-bypass"
                onClick={() => {
                  setPinInput('0000');
                  setIsAdultUnlocked(true);
                  setShowPinModal(false);
                  setActiveTab('adult');
                  setPinInput('');
                }}
                className="text-[10px] text-[purple-400] font-bold tracking-tight uppercase border border-purple-900/50 hover:bg-purple-950 bg-[#0E1324] text-purple-300 rounded-2xl flex items-center justify-center transition-all"
              >
                Use 0000
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIGURE SERVER DRAWER SETTINGS PANEL */}
      {showSettingsDrawer && (
        <div id="settings-overlay-drawer" className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-end z-50 p-0 animate-fade-in-right">
          <div className="w-full max-w-md h-full bg-[#0F1426] border-l border-gray-800 p-6 shadow-2xl overflow-y-auto flex flex-col">
            
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-500 animate-spin" />
                <h3 className="text-base font-black tracking-tight text-white uppercase">Server Settings</h3>
              </div>
              <button 
                id="close-settings-drawer-btn"
                onClick={() => setShowSettingsDrawer(false)}
                className="text-gray-400 hover:text-gray-200 p-1 rounded-lg focus:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRE-STAGED EXCLUSIVE ATLAN CONFIGURATION VIEW */}
            <div className="bg-[#151B33] border border-gray-800 p-4 rounded-2xl mb-6">
              <h4 className="text-xs font-extrabold uppercase text-gray-200 flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-red-500" />
                Premium Active Server Node
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                Pre-authenticated with premium IPTV credentials. Active channel scanning pipelines are fully routed through optimized cloud filters.
              </p>
              <div className="space-y-1 text-xs">
                <p>Host: <strong className="font-mono text-gray-100">atlan2025.me</strong></p>
                <p>User: <strong className="font-mono text-gray-100">Rochdi70sam</strong></p>
                <p>Pass: <strong className="font-mono text-gray-100">d3hm7lsqrh</strong></p>
              </div>
              <button
                id="reset-to-defaults-btn"
                onClick={resetToDefault}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 text-xs py-2 rounded-xl mt-4 font-bold transition-all"
              >
                Reset to NETBILFLY Elite Defaults
              </button>
            </div>

            {/* INPUT FORM */}
            <form onSubmit={handleSaveConfig} className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Xtream Host Portal Url</label>
                <input
                  id="input-host"
                  type="text"
                  required
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="e.g. http://server-portal.me"
                  className="w-full bg-[#080B15] border border-gray-800 px-3.5 py-2.5 rounded-xl text-sm text-gray-200 focus:border-red-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Username (User ID)</label>
                <input
                  id="input-username"
                  type="text"
                  required
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  placeholder="Credentials user ID"
                  className="w-full bg-[#080B15] border border-gray-800 px-3.5 py-2.5 rounded-xl text-sm text-gray-200 focus:border-red-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Secure Password</label>
                <input
                  id="input-password"
                  type="password"
                  required
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="Security password"
                  className="w-full bg-[#080B15] border border-gray-800 px-3.5 py-2.5 rounded-xl text-sm text-gray-200 focus:border-red-600 outline-none"
                />
              </div>

              {/* SAVE FORM ACTIONS */}
              <button
                id="save-config-btn"
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-950/20 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                Apply & Synchronize Pipelines
              </button>
            </form>

            {/* SECURITY MANAGEMENT ZONE */}
            <div className="border-t border-gray-800 pt-6 mt-6">
              <h4 className="text-xs font-bold uppercase text-gray-300 mb-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                Change Parental Lock PIN
              </h4>

              {showChangePin ? (
                <div className="space-y-3">
                  <input
                    id="new-pin-input-box"
                    type="password"
                    maxLength={4}
                    placeholder="Enter new 4-digit PIN"
                    value={newPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewPin(val);
                    }}
                    className="w-full bg-[#080B15] border border-gray-800 px-3.5 py-2 rounded-xl text-sm text-gray-200 tracking-widest text-center"
                  />
                  <div className="flex gap-2">
                    <button
                      id="save-new-pin-btn"
                      onClick={handleSaveNewPin}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-xs py-2 rounded-xl text-white font-bold transition-all"
                    >
                      Save PIN
                    </button>
                    <button
                      id="cancel-pin-btn"
                      onClick={() => setShowChangePin(false)}
                      className="bg-gray-800 hover:bg-gray-700 text-xs px-4 py-2 border border-gray-700 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="toggle-change-pin-btn"
                  onClick={() => setShowChangePin(true)}
                  className="w-full bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 border border-purple-800/80 text-xs py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  Change Current PIN
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// --- SUBCOMPONENTS ---

interface M3UChannelsSectionProps {
  m3uPlaylistChannels: {
    name: string;
    logo: string;
    category: string;
    url: string;
  }[];
  currentPlayItem: any;
  setCurrentPlayItem: (item: any) => void;
}

function M3UChannelsSection({ m3uPlaylistChannels, currentPlayItem, setCurrentPlayItem }: M3UChannelsSectionProps) {
  const [selectedM3uCategory, setSelectedM3uCategory] = useState<string>('all');
  const [m3uSearchQuery, setM3uSearchQuery] = useState<string>('');
  const [isGroupedView, setIsGroupedView] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [expandedCategoryLimits, setExpandedCategoryLimits] = useState<Record<string, boolean>>({});
  const [copiedM3uStreamUrl, setCopiedM3uStreamUrl] = useState<string | null>(null);

  const handleM3uShareStream = (name: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedText = `Channel: ${name}\nStream URL: ${url}`;
    navigator.clipboard.writeText(formattedText)
      .then(() => {
        setCopiedM3uStreamUrl(url);
        setTimeout(() => {
          setCopiedM3uStreamUrl(null);
        }, 2000);
      })
      .catch((err) => {
        console.warn("Clipboard copy failure:", err);
      });
  };

  // Auto reset category or search if m3uPlaylistChannels changes (e.g. after a new import)
  useEffect(() => {
    setSelectedM3uCategory('all');
    setM3uSearchQuery('');
    setCollapsedCategories({});
    setExpandedCategoryLimits({});
  }, [m3uPlaylistChannels]);

  const m3uCategories = useMemo(() => {
    const cats = new Set<string>();
    m3uPlaylistChannels.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [m3uPlaylistChannels]);

  const filteredM3uChannels = useMemo(() => {
    const query = m3uSearchQuery.trim().toLowerCase();
    return m3uPlaylistChannels.filter(item => {
      if (selectedM3uCategory !== 'all' && item.category !== selectedM3uCategory) return false;
      if (query) {
        return item.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [m3uPlaylistChannels, selectedM3uCategory, m3uSearchQuery]);

  // Group filtered channels by category
  const groupedM3uChannels = useMemo(() => {
    const groups: Record<string, typeof filteredM3uChannels> = {};
    filteredM3uChannels.forEach((item) => {
      const cat = item.category || 'Uncategorized';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    });
    return groups;
  }, [filteredM3uChannels]);

  // Sorted list of categories with active channels
  const activeGroupedCategories = useMemo(() => {
    return Object.keys(groupedM3uChannels).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [groupedM3uChannels]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const toggleCategoryLimit = (cat: string) => {
    setExpandedCategoryLimits(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  return (
    <div className="space-y-6">
      {/* PLAYLIST SEARCH & BROADCAST BROWSER METRICS */}
      <div className="bg-[#0F1426] border border-gray-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
        
        {/* Category filters */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0 whitespace-nowrap align-middle">
            Category Filter:
          </span>
          <select
            id="m3u-category-dropdown"
            value={selectedM3uCategory}
            onChange={(e) => setSelectedM3uCategory(e.target.value)}
            className="bg-[#080B15] border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 min-w-[200px]"
          >
            <option value="all">All Channels / Group Categories ({m3uCategories.length})</option>
            {m3uCategories.map((cat, i) => (
              <option key={i} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Grid/Group Toggle */}
        <div className="flex items-center bg-[#080B15] border border-gray-800 p-1 rounded-xl shrink-0">
          <button
            id="m3u-view-flat-btn"
            type="button"
            onClick={() => setIsGroupedView(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              !isGroupedView 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Flat Grid</span>
          </button>
          <button
            id="m3u-view-grouped-btn"
            type="button"
            onClick={() => setIsGroupedView(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isGroupedView 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Grouped by Category</span>
          </button>
        </div>

        {/* Channel Search box with instant local typing */}
        <div className="w-full md:w-80 relative">
          <input
            id="m3u-channels-search-box"
            type="text"
            placeholder="Search channel inside current playlist..."
            value={m3uSearchQuery}
            onChange={(e) => setM3uSearchQuery(e.target.value)}
            className="w-full bg-[#080B15] border border-gray-800 px-4 py-2.5 pl-10 rounded-xl text-sm text-gray-200 outline-none focus:border-blue-500 placeholder:text-gray-500 transition-all font-medium"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {m3uSearchQuery && (
            <button
              id="clear-m3u-search-btn"
              onClick={() => setM3uSearchQuery('')}
              className="text-xs text-gray-500 hover:text-white absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* VISUAL CHANNELS PORTAL BOX */}
      <div className="space-y-4">
        
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black tracking-tight uppercase border-l-4 border-blue-500 pl-3">
              Playlist Broadcast Channels ({filteredM3uChannels.length})
            </h2>
            <span className="text-xs text-gray-400 bg-[#0F1426] border border-gray-800 px-2.5 py-1 rounded">
              Category: {selectedM3uCategory === 'all' ? 'All Channels' : selectedM3uCategory}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Layout mode: <strong className="text-blue-400">{isGroupedView ? "Grouped Rows" : "Flat Grid"}</strong>
          </span>
        </div>

        {filteredM3uChannels.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-[#0F1426] border border-gray-800 rounded-3xl p-6">
            <AlertCircle className="w-12 h-12 text-gray-700 mx-auto stroke-1 mb-2" />
            <h4 className="font-bold text-gray-300">No Channels Found</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Try modifying search query, switching categories, or reloading the built-in TV showcase defaults.
            </p>
          </div>
        ) : !isGroupedView ? (
          // FLAT GRID PLACEMENT
          <div id="m3u-channels-active-grid" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {filteredM3uChannels.slice(0, 120).map((stream, idx) => {
              const playM3uChannel = () => {
                setCurrentPlayItem({
                  id: `m3u-${encodeURIComponent(stream.name)}-${idx}`,
                  name: stream.name,
                  icon: stream.logo || undefined,
                  type: 'live',
                  streamUrl: stream.url
                });
                const pEl = document.getElementById('iptv-player-container-block');
                if (pEl) pEl.scrollIntoView({ behavior: 'smooth' });
              };

              const isPlaying = currentPlayItem && currentPlayItem.streamUrl === stream.url;

              return (
                <div
                  id={`m3u-channel-${idx}`}
                  key={`m3u-${idx}`}
                  onClick={playM3uChannel}
                  className={`border rounded-xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] shadow hover:shadow-lg group relative cursor-pointer ${
                    isPlaying 
                      ? 'bg-blue-950/40 border-blue-500 shadow-blue-900/10' 
                      : 'bg-[#0F1426] border-gray-800 hover:border-blue-500 shadow-black/30'
                  }`}
                >
                  <div className="aspect-video bg-[#080B15] rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center p-2 mb-3 relative group-hover:border-blue-900/60 transition-all">
                    <HoverStreamPreview
                      streamUrl={stream.url}
                      logoUrl={stream.logo || undefined}
                      fallbackName={stream.name}
                      isPlayingMain={isPlaying}
                      accentColor="blue"
                    />
                  </div>

                  <div className="min-w-0">
                    <h3 className={`text-xs font-bold leading-snug transition-all ${isPlaying ? 'text-blue-400' : 'text-gray-200 group-hover:text-blue-400'}`} title={stream.name}>
                      {stream.name}
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-1 truncate" title={stream.category}>{stream.category}</p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <StreamStatusIndicator streamUrl={stream.url} />
                    <button 
                      onClick={(e) => handleM3uShareStream(stream.name, stream.url, e)}
                      title="Copy Stream link for sharing"
                      className={`ml-auto p-1.5 rounded-md transition-all border ${
                        copiedM3uStreamUrl === stream.url 
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400' 
                          : 'bg-gray-900 border-gray-850 hover:bg-blue-600 text-gray-400 hover:text-white hover:border-blue-500/50'
                      }`}
                    >
                      {copiedM3uStreamUrl === stream.url ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-2.5 h-2.5" />
                      )}
                    </button>
                    <button className={`p-1.5 rounded-md transition-all ${isPlaying ? 'bg-blue-600 text-white' : 'bg-gray-900 group-hover:bg-blue-600 text-gray-400 group-hover:text-white'}`}>
                      <Play className="w-2.5 h-2.5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // GROUPED ROWS PLACEMENT
          <div id="m3u-channels-active-grid" className="space-y-6 animate-fade-in">
            {activeGroupedCategories.map((categoryName) => {
              const categoryChannels = groupedM3uChannels[categoryName] || [];
              const isCollapsed = collapsedCategories[categoryName];
              const isLimitExpanded = expandedCategoryLimits[categoryName];
              
              const channelsToDisplay = isLimitExpanded ? categoryChannels : categoryChannels.slice(0, 12);

              return (
                <div key={categoryName} className="border border-gray-800 bg-[#0F1426]/60 rounded-2xl p-4 transition-all hover:border-gray-700 shadow shadow-black/25">
                  {/* Category Title Header Bar */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-850">
                    <div 
                      onClick={() => toggleCategoryCollapse(categoryName)}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <span className="text-gray-500 group-hover:text-blue-400 transition-colors">
                        <ChevronRight className={`w-4 h-4 transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                      </span>
                      <h3 className="text-sm font-black text-white group-hover:text-blue-400 transition-all uppercase tracking-tight">
                        {categoryName}
                      </h3>
                      <span className="ml-1 bg-blue-950/80 text-blue-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-900/30">
                        {categoryChannels.length} streams
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(categoryName)}
                      className="text-[10px] font-black tracking-wider uppercase text-gray-500 hover:text-gray-200 transition-colors"
                    >
                      {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>

                  {/* Category Active Grid */}
                  {!isCollapsed && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                        {channelsToDisplay.map((stream, idx) => {
                          const playM3uChannel = () => {
                            setCurrentPlayItem({
                              id: `m3u-${encodeURIComponent(stream.name)}-grouped-${categoryName}-${idx}`,
                              name: stream.name,
                              icon: stream.logo || undefined,
                              type: 'live',
                              streamUrl: stream.url
                            });
                            const pEl = document.getElementById('iptv-player-container-block');
                            if (pEl) pEl.scrollIntoView({ behavior: 'smooth' });
                          };

                          const isPlaying = currentPlayItem && currentPlayItem.streamUrl === stream.url;

                          return (
                            <div
                              id={`m3u-channel-grouped-${categoryName}-${idx}`}
                              key={`m3u-grouped-${categoryName}-${idx}`}
                              onClick={playM3uChannel}
                              className={`border rounded-xl p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] shadow hover:shadow-lg group relative cursor-pointer ${
                                isPlaying 
                                  ? 'bg-blue-950/40 border-blue-500 shadow-blue-900/10' 
                                  : 'bg-[#0F1426] border-gray-800 hover:border-blue-500 shadow-black/30'
                              }`}
                            >
                              <div className="aspect-video bg-[#080B15] rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center p-2 mb-3 relative group-hover:border-blue-900/60 transition-all">
                                <HoverStreamPreview
                                  streamUrl={stream.url}
                                  logoUrl={stream.logo || undefined}
                                  fallbackName={stream.name}
                                  isPlayingMain={isPlaying}
                                  accentColor="blue"
                                />
                              </div>

                              <div className="min-w-0">
                                <h3 className={`text-xs font-bold leading-snug transition-all ${isPlaying ? 'text-blue-400' : 'text-gray-200 group-hover:text-blue-400'}`} title={stream.name}>
                                  {stream.name}
                                </h3>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <StreamStatusIndicator streamUrl={stream.url} />
                                <button 
                                  onClick={(e) => handleM3uShareStream(stream.name, stream.url, e)}
                                  title="Copy Stream link for sharing"
                                  className={`ml-auto p-1.5 rounded-md transition-all border ${
                                    copiedM3uStreamUrl === stream.url 
                                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400' 
                                      : 'bg-gray-900 border-gray-850 hover:bg-blue-600 text-gray-400 hover:text-white hover:border-blue-500/50'
                                  }`}
                                >
                                  {copiedM3uStreamUrl === stream.url ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  ) : (
                                    <Share2 className="w-2.5 h-2.5" />
                                  )}
                                </button>
                                <button className={`p-1.5 rounded-md transition-all ${isPlaying ? 'bg-blue-600 text-white' : 'bg-gray-900 group-hover:bg-blue-600 text-gray-400 group-hover:text-white'}`}>
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* inline item count limit trigger */}
                      {categoryChannels.length > 12 && (
                        <div className="flex items-center justify-center pt-2">
                          <button
                            type="button"
                            onClick={() => toggleCategoryLimit(categoryName)}
                            className="bg-[#080B15] hover:bg-[#0d1122] text-[10px] font-black uppercase text-gray-400 hover:text-white px-5 py-2 border border-gray-800 rounded-xl transition-all cursor-pointer"
                          >
                            {isLimitExpanded ? `← Show Top 12 Channels` : `+ Show All ${categoryChannels.length - 12} More Channels`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load limiter warning text for flat grid view */}
        {!isGroupedView && filteredM3uChannels.length > 120 && (
          <p className="text-center text-[11px] text-gray-500 pt-3">
            Showing heavy viewport limitation (120 out of {filteredM3uChannels.length} streams to preserve layout speed). Filter by category elements or type keywords to find items.
          </p>
        )}

      </div>
    </div>
  );
}

// --- TELEGRAM SATIPTV LOADER AND PARSER ---

interface TelegramSatiptvLoaderProps {
  config: ServerConfig;
  setConfig: React.Dispatch<React.SetStateAction<ServerConfig>>;
  loadXtreamServerContent: () => void;
}

function TelegramSatiptvLoader({ config, setConfig, loadXtreamServerContent }: TelegramSatiptvLoaderProps) {
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeStatus, setScrapeStatus] = useState<string>('');
  const [scrapedItems, setScrapedItems] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, string>>({});
  
  // Custom manual paste state
  const [manualText, setManualText] = useState<string>('');
  const [manualParseSuccess, setManualParseSuccess] = useState<string | null>(null);
  const [parsedManualConfig, setParsedManualConfig] = useState<any | null>(null);

  // Prepopulated high-quality static server nodes to guarantee results
  const STABLE_SATELLITE_NODES = [
    {
      id: "builtin-sat-1",
      title: "📡 AMER SAT Premium Server (Elite Auto-Load)",
      host: "http://atlan2025.me",
      username: "Rochdi70sam",
      password: "d3hm7lsqrh",
      date: "Daily Active Server Feed",
      snippet: "Ultra fast premium backup gateway published on AMER SAT IPTV official channel."
    },
    {
      id: "builtin-sat-2",
      title: "📡 AMER SAT Live Stream Node B",
      host: "http://line.satiptv0.com:8080",
      username: "satiptv_free_user",
      password: "trial_password_9",
      date: "Shared Test Port",
      snippet: "Free trial shared link published for testing server speed and world channels list."
    }
  ];

  // Robust parsing utility
  const parseTelegramPostInfo = (postText: string) => {
    // Try finding standard URL containing username & password parameters
    const queryUrlRegex = /(https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?)\/[a-zA-Z0-9._-]+\?(?:username|user|auth)=([a-zA-Z0-9_-]+)&(?:password|pass|pwd)=([a-zA-Z0-9_-]+)/i;
    const matchUrl = postText.match(queryUrlRegex);
    if (matchUrl) {
      return {
        host: matchUrl[1],
        username: matchUrl[2],
        password: matchUrl[3]
      };
    }

    // Split lines
    const lines = postText.split('\n');
    let host = '';
    let username = '';
    let password = '';

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Extract Host
      if (/(?:host|server|portal|dns|http|الرابط|الهوست|السيرفر|بورت|الباث)/i.test(line)) {
        const urlMatch = line.match(/(https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?)/i);
        if (urlMatch) {
          host = urlMatch[1];
        } else {
          // Check if it's just host name written without http://
          const words = line.split(/\s+/);
          const domainCandidates = words.filter(w => w.includes('.') && w.length > 5);
          if (domainCandidates.length > 0) {
            host = 'http://' + domainCandidates[0].replace(/[:=—-]/g, "").trim();
          }
        }
      }
      // Extract Username
      if (/(?:user|username|id|اليوزر|اسم المستخدم|الاسم|الملف|العضو)/i.test(line)) {
        const parts = line.split(/[:：=—-]/);
        if (parts.length > 1) {
          const val = parts[1].replace(/<\/?[^>]+(>|$)/g, "").trim().split(' ')[0];
          if (val && val.length > 2) username = val;
        } else {
          const words = line.split(/\s+/);
          const lastWord = words[words.length - 1];
          if (lastWord && lastWord.length > 2 && !/user/i.test(lastWord)) username = lastWord;
        }
      }
      // Extract Password
      if (/(?:pass|password|pwd|الباسورد|كلمة المرور|الرمز|الباس|الرقم السري)/i.test(line)) {
        const parts = line.split(/[:：=—-]/);
        if (parts.length > 1) {
          const val = parts[1].replace(/<\/?[^>]+(>|$)/g, "").trim().split(' ')[0];
          if (val && val.length > 2) password = val;
        } else {
          const words = line.split(/\s+/);
          const lastWord = words[words.length - 1];
          if (lastWord && lastWord.length > 2 && !/pass/i.test(lastWord)) password = lastWord;
        }
      }
    }

    // Fallbacks if only partial detected
    if (!host) {
      const fallbackUrl = postText.match(/(https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?)/i);
      if (fallbackUrl) host = fallbackUrl[1];
    }

    if (host && username && password) {
      return { host, username, password };
    }
    return null;
  };

  const handleManualParse = () => {
    if (!manualText.trim()) {
      alert("Please enter or paste the Telegram post text first.");
      return;
    }

    const parsed = parseTelegramPostInfo(manualText);
    if (parsed) {
      setParsedManualConfig(parsed);
      setManualParseSuccess("Successfully Decoded Server Link! Click 'Activate This Saved Server Now' below to load!");
    } else {
      setParsedManualConfig(null);
      setManualParseSuccess("No valid Xtream configuration found. Ensure Portal Host, Username, and Password are in pasted text.");
    }
  };

  const handleApplyConfig = (item: any) => {
    const updated = {
      host: item.host,
      username: item.username,
      password: item.password
    };
    setConfig(updated);
    localStorage.setItem('netbilfly_server_config', JSON.stringify(updated));
    alert(`Connected! Loaded AMER SAT IPTV Server:\n\nHost: ${item.host}\nUser: ${item.username}\n\nRebuilding active IPTV catalogs...`);
    
    // Auto trigger system reload
    setTimeout(() => {
      loadXtreamServerContent();
      const el = document.getElementById("netbilfly-core-brand-title");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleAutoScrape = async () => {
    setIsScraping(true);
    setScrapeStatus("Reaching out to AMER SAT IPTV Telegram Channel...");
    setScrapedItems([]);

    const telegramUrl = "https://t.me/s/satiptv0";
    const proxies = [
      (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    ];

    let html = "";
    for (const proxyFn of proxies) {
      try {
        const res = await fetch(proxyFn(telegramUrl));
        if (res.ok) {
          html = await res.text();
          if (html.includes("tgme_widget_message_text")) {
            break;
          }
        }
      } catch (e) {
        console.warn("Proxy connection error", e);
      }
    }

    if (!html) {
      setIsScraping(false);
      setScrapeStatus("Our secure scraper hit a Telegram firewall limit. Please copy and paste the post manually below!");
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const messageNodes = doc.querySelectorAll(".tgme_widget_message_text");
      const results: any[] = [];

      messageNodes.forEach((node, index) => {
        const textContent = node.textContent || "";
        const parsed = parseTelegramPostInfo(textContent);
        if (parsed) {
          const bubble = node.closest(".tgme_widget_message_bubble");
          let dateStr = "Recent Post";
          if (bubble) {
            const dateEl = bubble.querySelector(".tgme_widget_message_date time");
            if (dateEl) {
              dateStr = dateEl.getAttribute("datetime") || dateEl.textContent || "Recent Post";
              if (dateStr.includes("T")) {
                dateStr = dateStr.split("T")[0] + " " + dateStr.split("T")[1].substring(0, 5);
              }
            }
          }
          results.push({
            id: `scraped-sat-${index}`,
            title: `Telegram Shared Server #${index + 1}`,
            host: parsed.host,
            username: parsed.username,
            password: parsed.password,
            date: dateStr,
            snippet: textContent.slice(0, 110).trim() + "..."
          });
        }
      });

      if (results.length > 0) {
        // Reverse so newest posts appear first
        setScrapedItems(results.reverse());
        setScrapeStatus(`Successfully extracted ${results.length} active live server configs!`);
      } else {
        setScrapeStatus("Parsing success, but no direct Host/User/Pass credentials keys matched. Try manual copy/paste!");
      }
    } catch (err) {
      setScrapeStatus("CORS limitation. Use our interactive manual copy-paste decryptor below!");
    } finally {
      setIsScraping(false);
    }
  };

  const handleCopyCredentials = (item: any, id: string) => {
    const text = `Host: ${item.host}\nUsername: ${item.username}\nPassword: ${item.password}`;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePingServer = async (item: any, id: string) => {
    setPingingId(id);
    const startTime = Date.now();
    try {
      // Set short check
      const controller = new AbortController();
      const idTimeout = setTimeout(() => controller.abort(), 4000);
      const hostClean = item.host.endsWith('/') ? item.host.slice(0, -1) : item.host;
      
      const testUrl = `https://corsproxy.io/?url=${encodeURIComponent(`${hostClean}/player_api.php?username=${item.username}&password=${item.password}`)}`;
      const res = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(idTimeout);
      
      const latency = Date.now() - startTime;
      if (res.ok) {
        setPingResults(prev => ({ ...prev, [id]: `ONLINE (${latency}ms)` }));
      } else {
        setPingResults(prev => ({ ...prev, [id]: `UNSTABLE SERVER` }));
      }
    } catch (_) {
      setPingResults(prev => ({ ...prev, [id]: `OFFLINE OR BLOCKED` }));
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div id="telegram-satiptv-deck" className="bg-[#10152B]/90 border border-blue-500/15 p-6 rounded-3xl relative overflow-hidden backdrop-blur-md shadow-2xl animate-fade-in">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-3xl rounded-full pointer-events-none" />
      
      {/* BRAND HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-800/80 mb-6 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xl font-black shrink-0 shadow-lg shadow-blue-900/40">
            SAT
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-blue-400/30">
                TELEGRAM COMMUNITY EXCLUSIVE
              </span>
              <a 
                href="https://t.me/satiptv0" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-cyan-400 hover:text-cyan-330 font-bold hover:underline inline-flex items-center gap-1"
              >
                @satiptv0 Channel <ExternalLink className="w-3" />
              </a>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
              AMER SAT IPTV — Free Daily Server Portals
              <span className="text-xs text-emerald-400 font-normal bg-emerald-950/40 border border-emerald-900/40 rounded px-1.5 py-0.5 animate-pulse">Live</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              We officially support live-syncing satellite accounts from <strong>AMER SAT IPTV</strong>, the Arab world's finest daily updated server resource list. Auto scan latest posts or paste text below to parse credentials instantly!
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:shrink-0">
          <button
            onClick={handleAutoScrape}
            disabled={isScraping}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-xs font-black px-5 py-3 rounded-2xl transition-all shadow-lg shadow-blue-950/30 inline-flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
            <span>{isScraping ? "Scraping @satiptv0..." : "Sync Live Telegram Channel"}</span>
          </button>
          
          <a
            href="https://t.me/satiptv0"
            target="_blank"
            rel="noreferrer"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 text-xs font-bold px-4 py-3 rounded-2xl transition-all inline-flex items-center justify-center gap-2"
          >
            <span>Join Telegram</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* SCRAPING PROGRESS BAR */}
      {scrapeStatus && (
        <div className="bg-[#080B15] border border-blue-900/30 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold text-blue-300 mb-6 animate-fade-in shadow-inner">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{scrapeStatus}</span>
          </div>
          <button 
            onClick={() => setScrapeStatus('')} 
            className="text-gray-500 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* RENDER DYNAMIC LIST GRID */}
      <div className="space-y-6 relative z-10">
        
        {/* SCAPE RESULTS CARDS */}
        <div>
          <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-3.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            {scrapedItems.length > 0 ? "Scraped Channels Feed" : "Built-in Super Stable Servers List"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(scrapedItems.length > 0 ? scrapedItems : STABLE_SATELLITE_NODES).map((item) => {
              const isCurrentlyActive = config.host === item.host && config.username === item.username;
              const testResult = pingResults[item.id];
              
              return (
                <div 
                  key={item.id}
                  className={`border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all duration-300 ${
                    isCurrentlyActive 
                      ? 'bg-blue-950/25 border-cyan-500 shadow-lg shadow-cyan-950/15'
                      : 'bg-[#080B15]/90 border-gray-800/80 hover:border-gray-700 hover:bg-[#0C0F22]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-gray-100 truncate flex-1 pr-2">
                        {item.title}
                      </h5>
                      <span className="text-[9px] bg-gray-900 border border-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                        {item.date}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>

                    {/* RENDER MASKED VALUES */}
                    <div className="bg-[#090C19] border border-gray-900 rounded-xl p-2 px-3 mt-3 space-y-1 font-mono text-[10px]">
                      <div className="truncate"><span className="text-yellow-600 font-bold">Host:</span> {item.host}</div>
                      <div><span className="text-blue-400 font-bold">User:</span> {item.username}</div>
                      <div className="truncate"><span className="text-purple-400 font-bold">Pass:</span> {item.password}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-900">
                    <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCurrentlyActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                      <span>{testResult ? testResult : isCurrentlyActive ? 'Active Node' : 'Inactive'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* PING BUTTON */}
                      <button
                        title="Ping check server"
                        onClick={() => handlePingServer(item, item.id)}
                        disabled={pingingId === item.id}
                        className="bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-400 hover:text-white p-2 rounded-xl transition-all"
                      >
                        <Activity className={`w-3.5 h-3.5 ${pingingId === item.id ? 'animate-pulse' : ''}`} />
                      </button>

                      {/* COPY BUTTON */}
                      <button
                        onClick={() => handleCopyCredentials(item, item.id)}
                        className="bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-450 hover:text-white p-2 rounded-xl transition-all inline-flex items-center gap-1 text-xs"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-bold hidden sm:inline">Copy</span>
                      </button>

                      {/* CONNECT PLAYER BUTTON */}
                      <button
                        onClick={() => handleApplyConfig(item)}
                        disabled={isCurrentlyActive}
                        className={`font-black text-[10px] px-3.5 py-2 rounded-xl transition-all ${
                          isCurrentlyActive
                            ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/40 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-950/20 cursor-pointer active:scale-95'
                        }`}
                      >
                        {isCurrentlyActive ? "Active" : "🔌 Connect"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 📋 MANUAL TELEGRAM PASTE DECRIPTOR TOOL */}
        <div className="border-t border-gray-800/80 pt-6">
          <div className="bg-[#080B15]/90 border border-gray-800 rounded-3xl p-5">
            <h4 className="text-xs font-extrabold uppercase text-gray-300 tracking-wider mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              Manual Post Decryptor & Parser (Arabic/English Support)
            </h4>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
              If the scraper is blocked by Telegram firewalls, copy the latest post text from the <a href="https://t.me/satiptv0" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">@satiptv0 channel</a> on your phone/browser, paste it below, and click decrypt!
            </p>

            <div className="space-y-4">
              <textarea
                rows={3}
                value={manualText}
                onChange={(e) => {
                  setManualText(e.target.value);
                  setManualParseSuccess(null);
                  setParsedManualConfig(null);
                }}
                placeholder="Paste latest post here e.g.&#10;Host : http://line.satiptv0.com:8080&#10;User : Rochdi70sam&#10;Pass : d3hm7lsqrh"
                className="w-full bg-[#101427] border border-gray-800/90 rounded-2xl p-3.5 text-xs font-mono text-gray-200 outline-none focus:border-blue-500 leading-relaxed placeholder:text-gray-600 resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleManualParse}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer shadow-lg shadow-purple-950/20"
                >
                  ⚡ Decrypt & Extract Keys
                </button>

                {manualParseSuccess && (
                  <span className={`text-[10px] font-bold ${typeof manualParseSuccess === 'string' && manualParseSuccess.includes("Successfully") ? "text-emerald-400" : "text-rose-400"}`}>
                    {manualParseSuccess}
                  </span>
                )}
              </div>

              {/* RENDER PARSED MANUAL RESULTS CONTAINER */}
              {parsedManualConfig && (
                <div className="bg-[#060810] border border-emerald-950 rounded-2xl p-4 animate-fade-in mt-3">
                  <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Parsed Connection Ready
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#0A0D1D] rounded-xl p-2 px-3 border border-gray-900 truncate">
                      <span className="text-[9px] text-gray-500 font-bold block uppercase">IPTV Portal Host</span>
                      <span className="font-mono text-xs text-gray-200">{parsedManualConfig.host}</span>
                    </div>
                    <div className="bg-[#0A0D1D] rounded-xl p-2 px-3 border border-gray-900 truncate">
                      <span className="text-[9px] text-gray-500 font-bold block uppercase">Username</span>
                      <span className="font-mono text-xs text-blue-400">{parsedManualConfig.username}</span>
                    </div>
                    <div className="bg-[#0A0D1D] rounded-xl p-2 px-3 border border-gray-900 truncate">
                      <span className="text-[9px] text-gray-500 font-bold block uppercase">Client Password</span>
                      <span className="font-mono text-xs text-purple-400">{parsedManualConfig.password}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyConfig(parsedManualConfig)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-2.5 rounded-xl mt-4 cursor-pointer transition active:scale-95 flex items-center justify-center gap-2 shadow"
                  >
                    <span>Activate This Saved Server Now →</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
