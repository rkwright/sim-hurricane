# sim-hurricane
An exploration of simulating the behaviour of hurricanes. Based on the work of Greg Holland (published in Monthly Weather Review).  This code was originally written in Fortran-77 (!) by Michael Drayton and has previously  been ported (by the author) to C++ with graphics in OpenGL.  This implementation is written in modern JavaScript (ES6) and uses WebGL (three.js) for graphics.

*Note that this port is very much a work-in-progress.  It does not yet work.*

#### Overview

This is a simple time-stepping model of hurricanes based on the work of Greg Holland,. The original paper is [here](http://journals.ametsoc.org/doi/pdf/10.1175/1520-0493%281980%29108%3C1212%3AAAMOTW%3E2.0.CO%3B2). 



#### The Algorithm



## Validating the Database

### **Goal:** 

Traverse all the storms and remove any storm with signficant amounts of missing data. Return some stats about the number of storms, missing data, etc.  Result of process is a revised version of the input JSON object which has only valid storms with valid data, though some of the data may have been intewrpolated.

#### **Missing Data**

There are typicqlly two types of missing data:

* inaccurate or missing observations, i.e. where the record is present but the contents are invalid
* missing oservations, i.e. where there is presumed periodicity to the data observations but at least some of them are missing

This approach should enumeraate both types though detection (and interpolation) of missing observations requires some assumptions about what the periodicity was expected to be.

In this case, we assume that all the observations made are present although some may be marked as missing or inaccurate.

#### **Validating the Database**

In the current (MHC) database, missing data is denoted by '-999' (without the quotes).  

Time observations are specified as YMD with a further delimitation to a four hour period, i.e. 0000, 0600, 1200, 1800. We asume that all time observations are complete and correct.

#### **Interpolation**

If there were no missing data then no interpolation would be required.  However, there are in fact a significant proportion of missing data.  Mostly, though, these consist of a lack of pressure data, which were not recorded until late in the 20th century.  However, where only a single data value is missing we use a linear interpolation to replace the missing value.  However, if there are three situations in which we consider the missing data as "fatal"

- where the missing data is in the first observation
- where the missing data is in the last observation
- where there is more than one missing observation in sequence

In each of these cases, linear interpolation is not valid so we treat these problems as fatal and discard the storm entirely.

#### **Validation Algorithm**

The algorithm for the validation consists of the following steps:

- For each **storm**:

    - Fetch the first and last observations and calculate the total storm length (in hours)

    - For each **entry**:

        - Check if any of the data is missing. 

        - If so, for each missing observation:

            - Calculate the time point relative to the start of the storm and store it in the entry

            - Check if the next ENTRY has a valid value for the current column

            - If so, fetch the previous ENTRY (which is guaranteed to be valid)

            - Perform linear interpolation to replace the missing value

            - If the next ENTRY's observation is also missing then abort the conversion of this storm and move to the next storm

                
