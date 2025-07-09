import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabasePlaylistsService } from '../services/supabase-playlists.service';

@Component({
    selector: 'app-supabase-test',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div>
            <h3>Supabase Playlists Service Test</h3>
            <button (click)="testConnection()">Test Supabase Connection</button>
            <button (click)="testGetAllPlaylists()">Test Get All Playlists</button>
            <div *ngIf="status">
                <p><strong>Status:</strong> {{ status }}</p>
            </div>
            <div *ngIf="error">
                <p style="color: red;"><strong>Error:</strong> {{ error }}</p>
            </div>
            <div *ngIf="playlists.length > 0">
                <h4>Playlists Found:</h4>
                <ul>
                    <li *ngFor="let playlist of playlists">{{ playlist.title }} ({{ playlist.count }} channels)</li>
                </ul>
            </div>
        </div>
    `,
    styles: [`
      :host { display: block; background: red; color: white; padding: 2rem; font-size: 2rem; z-index: 9999; }
    `]
})
export class SupabaseTestComponent implements OnInit {
    status: string = '';
    error: string = '';
    playlists: any[] = [];

    constructor(private supabasePlaylistsService: SupabasePlaylistsService) {}

    ngOnInit(): void {
        this.testConnection();
    }

    testConnection(): void {
        this.status = 'Testing connection...';
        this.error = '';
        
        // Simple test to see if the service can be instantiated
        try {
            this.status = 'Supabase service initialized successfully';
        } catch (err: any) {
            this.error = `Service initialization failed: ${err.message}`;
        }
    }

    testGetAllPlaylists(): void {
        this.status = 'Fetching playlists...';
        this.error = '';
        this.playlists = [];

        this.supabasePlaylistsService.getAllPlaylists().subscribe({
            next: (playlists) => {
                this.playlists = playlists;
                this.status = `Successfully fetched ${playlists.length} playlists`;
            },
            error: (err) => {
                this.error = `Failed to fetch playlists: ${err.message}`;
                this.status = 'Failed';
            }
        });
    }
} 