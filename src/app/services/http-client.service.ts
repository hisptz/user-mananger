import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {catchError, flatMap} from 'rxjs/operators';
import {Observable} from 'rxjs/index';

@Injectable({
  providedIn: 'root'
})
export class HttpClientService {


  private _rootUrl: string;
  private _apiRootUrl: string;

  constructor(private httpClient: HttpClient) {
  }

  get(url: string,
      useRootUrl: boolean = false,
      useExternalUrl: boolean = false): Observable<any> {
    const rootUrlPromise = useRootUrl
      ? this._getRootUrl()
      : this._getApiRootUrl();

    return useExternalUrl
      ? this.httpClient.get(url).pipe(catchError(error => this._handleError(error)))
      : rootUrlPromise.pipe(
        flatMap((rootUrl: string) => this.httpClient.get(rootUrl + url).pipe(catchError(error => this._handleError(error)))
        )
      );
  }

  post(url: string, data: any, useRootUrl: boolean = false) {
    return new Observable(observer => {
      const rootUrlPromise = useRootUrl ? this._getRootUrl() : this._getApiRootUrl();

      rootUrlPromise.subscribe((rootUrl: string) => {
        this.httpClient.post(rootUrl + url, data).subscribe((response: any) => {
          observer.next(response);
          observer.complete();
        }, (error) => {

          console.log(this._handleError(error));
          observer.error(this._handleError(error));
        });
      });
    });
  }

  put(url: string, data: any, useRootUrl: boolean = false) {
    return new Observable(observer => {
      const rootUrlPromise = useRootUrl ? this._getRootUrl() : this._getApiRootUrl();

      rootUrlPromise.subscribe((rootUrl: string) => {
        this.httpClient.put(rootUrl + url, data).subscribe((response: any) => {
          observer.next(response);
          observer.complete();
        }, (error) => {

          console.log(this._handleError(error));
          observer.error(this._handleError(error));
        });
      });
    });
  }

  delete(url: string, useRootUrl: boolean = false) {
    return new Observable(observer => {
      const rootUrlPromise = useRootUrl ? this._getRootUrl() : this._getApiRootUrl();

      rootUrlPromise.subscribe((rootUrl: string) => {
        this.httpClient.delete(rootUrl + url).subscribe((response: any) => {
          observer.next(response);
          observer.complete();
        }, (error) => {

          console.log(this._handleError(error));
          observer.error(this._handleError(error));
        });
      });
    });
  }

  // Private methods

  private _handleError(err: HttpErrorResponse) {
    let error = null;
    if (err.error instanceof Error) {
      // A client-side or network error occurred. Handle it accordingly.
      error = {
        message: err.error,
        status: err.status,
        statusText: err.statusText
      };
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      error = {
        message: err.error instanceof Object ? err.error.message : err.error,
        status: err.status,
        statusText: err.statusText
      };
    }

    return new Observable(error);
  }

  /**
   * Get root url
   * @returns {Observable<string>}
   * @private
   */
  private _getRootUrl(): Observable<string> {
    return new Observable(observer => {
      observer.next('/');
      observer.complete();
    });
  }

  private _getApiRootUrl() {
    return new Observable(observer => {
      if (this._apiRootUrl) {
        observer.next(this._apiRootUrl);
        observer.complete();
      } else {
        this._getRootUrl().subscribe((rootUrl: string) => {
          this._apiRootUrl = rootUrl + 'api/';
          observer.next(this._apiRootUrl);
          observer.complete();
        });
      }
    });
  }

  private _getSystemInfo(): Observable<any> {
    return Observable.create(observer => {
      this.get('api/system/info', true).subscribe((systemInfo: any) => {
        observer.next(systemInfo);
        observer.complete();
      }, systemInfoError => {
        console.warn(systemInfoError);
        observer.next(null);
        observer.complete();
      });
    });
  }

  /**
   * Get api part of url
   * @returns {Observable<string>}
   */
  private _getApiUrlSection(): Observable<string> {
    return new Observable(observer => {
      this._getSystemInfo().subscribe((systemInfo: any) => {
        let apiUrlSection = 'api/';
        const maxSupportedVersion = 2.25;
        const currentVersion = systemInfo ? systemInfo.version : maxSupportedVersion;
        if (currentVersion > 2.24) {
          apiUrlSection += currentVersion > maxSupportedVersion ?
            this._getVersionDecimalPart(maxSupportedVersion) + '/' :
            this._getVersionDecimalPart(currentVersion) + '/';
        }

        observer.next(apiUrlSection);
        observer.complete();
      });
    });
  }

  private _getVersionDecimalPart(version: number) {
    return version.toString().split('.')[1];
  }

}
