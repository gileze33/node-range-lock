# node-range-lock
Distributed time-range based locking engine backed by redis and MySQL

range-lock was designed for use in a booking/appointments management app, where need to lock a key, but only want to have that lock affect a certain range of time (the appointment you're attempting to create). In such a distributed system, the times required for a lock to remain open can be anywhere between 1 second and 2 minutes dependant upon the external processes involved (such as charging cards etc). In such a situation, locking the entire key just doesn't make sense, especially if you have a high concurrency of creates for a certain key.

## Setup
You need a redis instance for thread-safeness, as well as a MySQL DB for the actual lock store.

The constructor for range-lock takes two parameters:
 - A function that will return an instance of the node 'redis' client
 - A URL pointing to a MySQL database (this uses node-orm under the hood)
 
E.g.


    var RangeLock = require('range-lock');
    var rangeLock = new RangeLock(require('redis').createClient(), 'mysql://root:pass@localhost/locks');


## Usage

range-lock instances have 3 methods you'll use to set, get and clear locks

### set(key, startUnixTimestamp, endUnixTimestamp, stringDataOrNull, ttlMS, callback)

    rangeLock.set('my-key', 10, 20, 'this is a test', 30000, function(err, success, lock) {
        if(err) throw err;
        
        if(success) {
            // lock.id can now be used alongside the key to retrieve/clear the lock information in another process / request
        }
        else {
            // this key has an overlapping lock currently set
            // lock is the overlapping lock in case you want to inspect it / return the information to the client
        }
    });

### get(key, lockID, callback)

    var lock = rangeLock.get('my-key', 'lock-id-returned-from-set', function(err, lock) {
        if(err) throw err;
        
        if(lock === false) {
            // the lock has gone away
        }
        else {
            // lock is now equal to the same object you got back from lockStore#set earlier
            // lock.data contains the string data you passed in, if any
        }
    });
    
### clear(key, lockID, callback)

    rangeLock.clear('my-key', 'lock-id-returned-from-set', function(err) {
        if(err) throw err;
        
        // lock is now cleared
    });



*We also provide a convienience method on 'lock' instances returned from #set and #get, allowing you to call lock.release (this is just bound to lockStore.clear)*

E.g.

    var lock = rangeLock.get('my-key', 'lock-id-returned-from-set', function(err, lock) {
        if(err) throw err;
        
        if(lock !== false) {
            // we have a valid lock
            
            // do something
            
            // now release the lock
            lock.release(optionalCallback);
        }
    });
    
