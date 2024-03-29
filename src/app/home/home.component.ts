import { Component, OnInit, inject } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, Timestamp, collection, doc, onSnapshot, orderBy, query, writeBatch } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TeamEvent } from '../models/team-event.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private analytics: Analytics = inject(Analytics);
  isLoading = true;
  private auth: Auth = inject(Auth);
  user: User | null = null;
  teamEvents: TeamEvent[] = [];
  pastEvents: TeamEvent[] = [];

  constructor(
    private router: Router,
    private snackBar: MatSnackBar,
  ) { }

  async ngOnInit(): Promise<void> {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.user = user;
        const q = query(collection(this.firestore, (user.uid === 'EifNapX5ywgRMtjzfJHyd9gYZEf2') ? `events` : `users/${this.user.uid}/events`), orderBy('dateTime', 'desc'));
        onSnapshot(q, (querySnapshot) => {
          this.teamEvents = [];
          this.pastEvents = [];
          querySnapshot.forEach((doc) => {
            var teamEvent = doc.data() as TeamEvent;
            teamEvent.id = doc.id;
            if ((teamEvent.dateTime as Timestamp).toDate() > new Date()) {
              this.teamEvents.push(teamEvent);
            } else {
              this.pastEvents.push(teamEvent);
            }
          });
          this.teamEvents.sort((a, b) => {
            return (a.dateTime as Timestamp).toDate().getTime() - (b.dateTime as Timestamp).toDate().getTime();
          });
          this.isLoading = false;
        });
      } else {
        console.error('User object is NULL - user not logged in.');
        this.isLoading = false;
        return;
      }
    });
  }

  createNewEvent(): void {
    if (!this.user) {
      console.error('User object is falsy');
      this.snackBar.open($localize`Please sign in to continue`, 'OK');
      this.router.navigate([`/`]);
      return;
    }
    const eventId = doc(collection(this.firestore, 'events')).id;
    logEvent(this.analytics, 'new_event', { uid: this.user.uid, eventId: eventId })
    const batch = writeBatch(this.firestore);
    const newEvent: TeamEvent = {
      owner: this.user.uid,
      dateTime: new Date(),
      icon: this.user.photoURL,
      isLimitedAttendees: false,
      isEventFee: false,
      isTeamAllocations: false,
      description: '',
    }
    /* disable until test mode is implemented
    if (this.user?.isTester) {
      newEvent.isTestMode = true;
    }
    */

    batch.set(doc(collection(this.firestore, 'events'), eventId), newEvent);
    batch.set(doc(collection(this.firestore, 'users', this.user.uid, 'events'), eventId), {
      dateTime: newEvent.dateTime,
      icon: this.user.photoURL,
    });
    batch.commit().then(() => {
      this.router.navigate([`event/${eventId}`]);
    });
  }

  teamEventDateTime(dateTime: Date | Timestamp) {
    return (<Timestamp>dateTime)?.toDate();
  }
}
