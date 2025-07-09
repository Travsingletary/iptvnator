import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map, switchMap, of, combineLatest } from 'rxjs';
import { Channel } from '../../../shared/channel.interface';
import { GLOBAL_FAVORITES_PLAYLIST_ID } from '../../../shared/constants';
import {
    Playlist,
    PlaylistUpdateState,
} from '../../../shared/playlist.interface';
import {
    aggregateFavoriteChannels,
    createFavoritesPlaylist,
    createPlaylistObject,
} from '../../../shared/playlist.utils';
import { XtreamItem } from '../../../shared/xtream-item.interface';
import { XtreamSerieItem } from '../../../shared/xtream-serie-item.interface';
import { PlaylistMeta } from '../shared/playlist-meta.type';

// Supabase table interfaces
interface UserPlaylist {
    id: string;
    user_id?: string;
    name: string;
    source_url?: string;
    credentials?: any;
    channel_count: number;
    last_sync?: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

interface PlaylistChannel {
    id: string;
    playlist_id: string;
    channel_id: string;
    name: string;
    logo_url?: string;
    stream_url: string;
    group_name?: string;
    category?: string;
    country?: string;
    language?: string;
    tvg_id?: string;
    tvg_name?: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

@Injectable({
    providedIn: 'root',
})
export class SupabasePlaylistsService {
    private supabase: SupabaseClient;

    constructor(
        private snackBar: MatSnackBar,
        private translateService: TranslateService
    ) {
        // Initialize Supabase client
        const supabaseUrl = 'https://vifeazkwjreoxkspbygg.supabase.co';
        let supabaseKey: string | undefined;
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                // @ts-ignore
                supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            }
        } catch {
            if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_KEY) {
                supabaseKey = process.env.SUPABASE_KEY;
            }
        }
        if (!supabaseKey) {
            console.error('Supabase key not found. Check your .env file.');
            throw new Error('Supabase key not configured');
        }
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Convert Playlist to UserPlaylist format
    private playlistToUserPlaylist(playlist: Playlist): Partial<UserPlaylist> {
        return {
            id: playlist._id,
            name: playlist.title,
            source_url: playlist.url,
            credentials: playlist.username && playlist.password ? {
                username: playlist.username,
                password: playlist.password,
                serverUrl: playlist.serverUrl,
                portalUrl: playlist.portalUrl,
                macAddress: playlist.macAddress,
                userAgent: playlist.userAgent
            } : null,
            channel_count: playlist.playlist?.items?.length || 0,
            last_sync: playlist.updateDate ? new Date(playlist.updateDate).toISOString() : undefined,
            is_active: playlist.autoRefresh !== false,
            sort_order: playlist.position || 0
        };
    }

    // Convert UserPlaylist back to Playlist format
    private userPlaylistToPlaylist(userPlaylist: UserPlaylist, channels: PlaylistChannel[] = []): Playlist {
        const credentials = userPlaylist.credentials || {};
        return {
            _id: userPlaylist.id,
            title: userPlaylist.name,
            url: userPlaylist.source_url,
            username: credentials.username,
            password: credentials.password,
            serverUrl: credentials.serverUrl,
            portalUrl: credentials.portalUrl,
            macAddress: credentials.macAddress,
            userAgent: credentials.userAgent,
            autoRefresh: userPlaylist.is_active,
            position: userPlaylist.sort_order,
            updateDate: userPlaylist.last_sync ? new Date(userPlaylist.last_sync).getTime() : Date.now(),
            updateState: PlaylistUpdateState.UPDATED,
            count: userPlaylist.channel_count,
            importDate: userPlaylist.created_at || new Date().toISOString(),
            lastUsage: userPlaylist.updated_at || new Date().toISOString(),
            playlist: {
                header: { raw: '' },
                items: channels.map(channel => ({
                    id: channel.channel_id,
                    name: channel.name,
                    url: channel.stream_url,
                    group: { title: channel.group_name || '' },
                    tvg: {
                        id: channel.tvg_id || '',
                        name: channel.tvg_name || '',
                        url: '',
                        logo: channel.logo_url || '',
                        rec: ''
                    },
                    raw: `${channel.name},${channel.stream_url}`,
                    http: { referrer: '', 'user-agent': '', origin: '' },
                    radio: ''
                })) as Channel[]
            },
            favorites: []
        };
    }

    getAllPlaylists(): Observable<Playlist[]> {
        return from(this.supabase
            .from('user_playlists')
            .select('*')
            .order('sort_order', { ascending: true })
        ).pipe(
            map(response => {
                if (response.error) {
                    console.error('Error fetching playlists:', response.error);
                    throw new Error(response.error.message);
                }
                return response.data || [];
            }),
            switchMap(userPlaylists => {
                const playlistObservables = userPlaylists.map(userPlaylist =>
                    from(this.supabase
                        .from('playlist_channels')
                        .select('*')
                        .eq('playlist_id', userPlaylist.id)
                        .order('sort_order', { ascending: true })
                    ).pipe(
                        map(channelsResponse => {
                            if (channelsResponse.error) {
                                console.error('Error fetching channels:', channelsResponse.error);
                                return this.userPlaylistToPlaylist(userPlaylist, []);
                            }
                            return this.userPlaylistToPlaylist(userPlaylist, channelsResponse.data || []);
                        })
                    )
                );
                return playlistObservables.length > 0 ? combineLatest(playlistObservables) : of([]);
            })
        );
    }

    addPlaylist(playlist: Playlist): Observable<any> {
        const userPlaylist = this.playlistToUserPlaylist(playlist);
        return from(this.supabase
            .from('user_playlists')
            .insert([userPlaylist])
        ).pipe(
            switchMap(response => {
                if (response.error) {
                    console.error('Error adding playlist:', response.error);
                    throw new Error(response.error.message);
                }
                if (playlist.playlist?.items?.length > 0) {
                    const channels = playlist.playlist.items.map((channel, index) => ({
                        playlist_id: playlist._id,
                        channel_id: channel.id,
                        name: channel.name,
                        logo_url: channel.logo,
                        stream_url: channel.url,
                        group_name: channel.group?.title,
                        category: channel.category,
                        country: channel.country,
                        language: channel.language,
                        tvg_id: channel.tvg?.id,
                        tvg_name: channel.tvg?.name,
                        is_active: true,
                        sort_order: index
                    }));
                    return from(this.supabase
                        .from('playlist_channels')
                        .insert(channels)
                    );
                }
                return of(response);
            })
        );
    }

    getPlaylist(id: string): Observable<Playlist> {
        if (id === GLOBAL_FAVORITES_PLAYLIST_ID) {
            return this.getPlaylistWithGlobalFavorites();
        }
        return from(this.supabase
            .from('user_playlists')
            .select('*')
            .eq('id', id)
            .single()
        ).pipe(
            switchMap(response => {
                if (response.error) {
                    console.error('Error fetching playlist:', response.error);
                    throw new Error(response.error.message);
                }
                const userPlaylist = response.data;
                if (!userPlaylist) {
                    throw new Error('Playlist not found');
                }
                return from(this.supabase
                    .from('playlist_channels')
                    .select('*')
                    .eq('playlist_id', id)
                    .order('sort_order', { ascending: true })
                ).pipe(
                    map(channelsResponse => {
                        if (channelsResponse.error) {
                            console.error('Error fetching channels:', channelsResponse.error);
                            return this.userPlaylistToPlaylist(userPlaylist, []);
                        }
                        return this.userPlaylistToPlaylist(userPlaylist, channelsResponse.data || []);
                    })
                );
            })
        );
    }

    deletePlaylist(playlistId: string): Observable<any> {
        return from(this.supabase
            .from('playlist_channels')
            .delete()
            .eq('playlist_id', playlistId)
        ).pipe(
            switchMap(() => {
                return from(this.supabase
                    .from('user_playlists')
                    .delete()
                    .eq('id', playlistId)
                );
            }),
            map(response => {
                if (response.error) {
                    console.error('Error deleting playlist:', response.error);
                    throw new Error(response.error.message);
                }
                return response;
            })
        );
    }

    updatePlaylist(playlistId: string, updatedPlaylist: Playlist): Observable<any> {
        const userPlaylist = this.playlistToUserPlaylist(updatedPlaylist);
        userPlaylist.updated_at = new Date().toISOString();
        return from(this.supabase
            .from('user_playlists')
            .update(userPlaylist)
            .eq('id', playlistId)
        ).pipe(
            map(response => {
                if (response.error) {
                    console.error('Error updating playlist:', response.error);
                    throw new Error(response.error.message);
                }
                return response;
            })
        );
    }

    getPlaylistById(id: string): Observable<Playlist> {
        return this.getPlaylist(id);
    }

    getPlaylistWithGlobalFavorites(): Observable<Playlist> {
        // Return a fully populated Playlist object for favorites (empty for now)
        const now = new Date().toISOString();
        const playlist: Playlist = {
            _id: 'favorites',
            title: 'Global Favorites',
            url: '',
            username: '',
            password: '',
            serverUrl: '',
            portalUrl: '',
            macAddress: '',
            userAgent: '',
            autoRefresh: false,
            position: 0,
            updateDate: Date.now(),
            updateState: PlaylistUpdateState.UPDATED,
            count: 0,
            importDate: now,
            lastUsage: now,
            playlist: { header: { raw: '' }, items: [] },
            favorites: []
        };
        return of(playlist);
    }

    updatePlaylistMeta(updatedPlaylist: PlaylistMeta): Observable<any> {
        if (!updatedPlaylist._id) {
            throw new Error('Playlist ID is required');
        }
        const now = new Date().toISOString();
        const playlist: Playlist = {
            _id: updatedPlaylist._id,
            title: updatedPlaylist.title,
            url: updatedPlaylist.serverUrl || '',
            username: updatedPlaylist.username || '',
            password: updatedPlaylist.password || '',
            serverUrl: updatedPlaylist.serverUrl || '',
            portalUrl: updatedPlaylist.portalUrl || '',
            macAddress: updatedPlaylist.macAddress || '',
            userAgent: updatedPlaylist.userAgent || '',
            autoRefresh: updatedPlaylist.autoRefresh,
            position: 0,
            updateDate: Date.now(),
            updateState: PlaylistUpdateState.UPDATED,
            count: 0,
            importDate: now,
            lastUsage: now,
            playlist: { header: { raw: '' }, items: [] },
            favorites: []
        };
        return this.updatePlaylist(updatedPlaylist._id, playlist);
    }

    updateFavorites(id: string, favorites: string[]): Observable<any> {
        // Not implemented yet
        return of(null);
    }

    getFavoriteChannels(playlistId: string): Observable<Channel[]> {
        // Not implemented yet
        return of([]);
    }
} 