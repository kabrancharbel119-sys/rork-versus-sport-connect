export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          full_name: string
          avatar: string | null
          phone: string | null
          city: string
          country: string
          bio: string | null
          sports: Json
          stats: Json
          reputation: number
          wallet_balance: number
          teams: Json
          followers: number
          following: number
          is_verified: boolean
          is_premium: boolean
          is_banned: boolean
          role: string
          location_lat: number | null
          location_lng: number | null
          location_city: string | null
          location_country: string | null
          availability: Json
          referral_code: string | null
          password_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          username: string
          full_name: string
          avatar?: string | null
          phone?: string | null
          city: string
          country: string
          bio?: string | null
          sports?: Json
          stats?: Json
          reputation?: number
          wallet_balance?: number
          teams?: Json
          followers?: number
          following?: number
          is_verified?: boolean
          is_premium?: boolean
          is_banned?: boolean
          role?: string
          location_lat?: number | null
          location_lng?: number | null
          location_city?: string | null
          location_country?: string | null
          availability?: Json
          referral_code?: string | null
          password_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          full_name?: string
          avatar?: string | null
          phone?: string | null
          city?: string
          country?: string
          bio?: string | null
          sports?: Json
          stats?: Json
          reputation?: number
          wallet_balance?: number
          teams?: Json
          followers?: number
          following?: number
          is_verified?: boolean
          is_premium?: boolean
          is_banned?: boolean
          role?: string
          location_lat?: number | null
          location_lng?: number | null
          location_city?: string | null
          location_country?: string | null
          availability?: Json
          referral_code?: string | null
          password_hash?: string | null
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          logo: string | null
          sport: string
          format: string
          level: string
          ambiance: string
          city: string
          country: string
          description: string | null
          captain_id: string | null
          co_captain_ids: Json
          members: Json
          max_members: number
          stats: Json
          reputation: number
          is_recruiting: boolean
          join_requests: Json
          custom_roles: Json
          location_lat: number | null
          location_lng: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo?: string | null
          sport: string
          format: string
          level: string
          ambiance: string
          city: string
          country: string
          description?: string | null
          captain_id?: string | null
          co_captain_ids?: Json
          members?: Json
          max_members?: number
          stats?: Json
          reputation?: number
          is_recruiting?: boolean
          join_requests?: Json
          custom_roles?: Json
          location_lat?: number | null
          location_lng?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo?: string | null
          sport?: string
          format?: string
          level?: string
          ambiance?: string
          city?: string
          country?: string
          description?: string | null
          captain_id?: string | null
          co_captain_ids?: Json
          members?: Json
          max_members?: number
          stats?: Json
          reputation?: number
          is_recruiting?: boolean
          join_requests?: Json
          custom_roles?: Json
          location_lat?: number | null
          location_lng?: number | null
          created_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          sport: string
          format: string
          type: string
          status: string
          home_team_id: string | null
          away_team_id: string | null
          venue_id: string | null
          venue_data: Json | null
          date_time: string
          duration: number
          level: string
          ambiance: string
          max_players: number
          registered_players: Json
          score_home: number | null
          score_away: number | null
          mvp_id: string | null
          created_by: string | null
          entry_fee: number
          prize: number
          needs_players: boolean
          location_lat: number | null
          location_lng: number | null
          player_stats: Json
          created_at: string
        }
        Insert: {
          id?: string
          sport: string
          format: string
          type: string
          status?: string
          home_team_id?: string | null
          away_team_id?: string | null
          venue_id?: string | null
          venue_data?: Json | null
          date_time: string
          duration?: number
          level: string
          ambiance: string
          max_players?: number
          registered_players?: Json
          score_home?: number | null
          score_away?: number | null
          mvp_id?: string | null
          created_by?: string | null
          entry_fee?: number
          prize?: number
          needs_players?: boolean
          location_lat?: number | null
          location_lng?: number | null
          player_stats?: Json
          created_at?: string
        }
        Update: {
          id?: string
          sport?: string
          format?: string
          type?: string
          status?: string
          home_team_id?: string | null
          away_team_id?: string | null
          venue_id?: string | null
          venue_data?: Json | null
          date_time?: string
          duration?: number
          level?: string
          ambiance?: string
          max_players?: number
          registered_players?: Json
          score_home?: number | null
          score_away?: number | null
          mvp_id?: string | null
          created_by?: string | null
          entry_fee?: number
          prize?: number
          needs_players?: boolean
          location_lat?: number | null
          location_lng?: number | null
          player_stats?: Json
          created_at?: string
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          description: string | null
          sport: string
          format: string
          type: string
          status: string
          level: string
          max_teams: number
          registered_teams: Json
          entry_fee: number
          prize_pool: number
          prizes: Json
          venue_data: Json | null
          start_date: string
          end_date: string
          match_ids: Json
          winner_id: string | null
          sponsor_name: string | null
          sponsor_logo: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          sport: string
          format: string
          type: string
          status?: string
          level: string
          max_teams?: number
          registered_teams?: Json
          entry_fee?: number
          prize_pool?: number
          prizes?: Json
          venue_data?: Json | null
          start_date: string
          end_date: string
          match_ids?: Json
          winner_id?: string | null
          sponsor_name?: string | null
          sponsor_logo?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          sport?: string
          format?: string
          type?: string
          status?: string
          level?: string
          max_teams?: number
          registered_teams?: Json
          entry_fee?: number
          prize_pool?: number
          prizes?: Json
          venue_data?: Json | null
          start_date?: string
          end_date?: string
          match_ids?: Json
          winner_id?: string | null
          sponsor_name?: string | null
          sponsor_logo?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      chat_rooms: {
        Row: {
          id: string
          team_id: string | null
          name: string
          type: string
          participants: Json
          last_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          name: string
          type?: string
          participants?: Json
          last_message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          name?: string
          type?: string
          participants?: Json
          last_message_id?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string | null
          sender_id: string | null
          content: string
          type: string
          mentions: Json
          read_by: Json
          created_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          sender_id?: string | null
          content: string
          type?: string
          mentions?: Json
          read_by?: Json
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string | null
          sender_id?: string | null
          content?: string
          type?: string
          mentions?: Json
          read_by?: Json
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          type: string
          title: string
          message: string
          data: Json | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: string
          title: string
          message: string
          data?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string
          title?: string
          message?: string
          data?: Json | null
          is_read?: boolean
          created_at?: string
        }
      }
      venues: {
        Row: {
          id: string
          name: string
          address: string
          city: string
          sport: Json
          price_per_hour: number
          images: Json
          rating: number
          amenities: Json
          latitude: number | null
          longitude: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          city: string
          sport?: Json
          price_per_hour?: number
          images?: Json
          rating?: number
          amenities?: Json
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          city?: string
          sport?: Json
          price_per_hour?: number
          images?: Json
          rating?: number
          amenities?: Json
          latitude?: number | null
          longitude?: number | null
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          venue_id: string | null
          user_id: string | null
          match_id: string | null
          date: string
          start_time: string
          end_time: string
          total_price: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          venue_id?: string | null
          user_id?: string | null
          match_id?: string | null
          date: string
          start_time: string
          end_time: string
          total_price?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          venue_id?: string | null
          user_id?: string | null
          match_id?: string | null
          date?: string
          start_time?: string
          end_time?: string
          total_price?: number
          status?: string
          created_at?: string
        }
      }
      referrals: {
        Row: {
          id: string
          referrer_id: string | null
          referred_id: string | null
          code: string
          reward_claimed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          referrer_id?: string | null
          referred_id?: string | null
          code: string
          reward_claimed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          referrer_id?: string | null
          referred_id?: string | null
          code?: string
          reward_claimed?: boolean
          created_at?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string | null
          following_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          follower_id?: string | null
          following_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string | null
          following_id?: string | null
          created_at?: string
        }
      }
      trophies: {
        Row: {
          id: string
          user_id: string | null
          type: string
          name: string
          description: string | null
          icon: string | null
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: string
          name: string
          description?: string | null
          icon?: string | null
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string
          name?: string
          description?: string | null
          icon?: string | null
          unlocked_at?: string
        }
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string | null
          token: string
          platform: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          token: string
          platform?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          token?: string
          platform?: string | null
          created_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          subject: string
          message: string
          status: string
          priority: string
          response: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          subject: string
          message: string
          status?: string
          priority?: string
          response?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          subject?: string
          message?: string
          status?: string
          priority?: string
          response?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
