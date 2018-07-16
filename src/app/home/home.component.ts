import {Component, OnChanges, OnInit} from '@angular/core';
import {Observable} from 'rxjs/index';
import {HttpClientService} from '../services/http-client.service';
import {PagerService} from '../services/pager.service';
import {IndexDbService} from '../services/index-db.service';
import {forkJoin} from 'rxjs/observable/forkJoin';
declare let $;
declare let kendo;
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnChanges {
  userTable: {
    headers: string[],
    rows: { colums: { value: string }[] }[]
  };

  userSchema: any = {
    name: 'water_point_users',
    keyPath: 'id'
  };

  loadingInformation = '';

  searchFields: string;

  query: string;

  // array of all items to be paged
  private allItems: any[];

  // pager object
  pager: any = {};

  // paged items
  pagedItems: any[];
  pageSize = 15;
  currentPage = 1;


  pageSizeChanger = [
    {
      item: '3', count: 3, className: ''
    },
    {
      item: '15', count: 10, className: 'active'
    },
    {
      item: '100', count: 100, className: ''
    },
    {
      item: 'Show all', count: null, className: ''
    }
  ]

  constructor(private http: HttpClientService, private pagerService: PagerService, private indexDBService: IndexDbService) {
  }

  ngOnInit() {
    let orguntsId = '';
    this.loadingInformation = 'Please wait... Loading Distribution Point Users';
    this.getCurrentLoggenUser().subscribe((currentUser) => {
      currentUser.organisationUnits.forEach((orgUnit) => {
        orguntsId += orgUnit.id + ',';
      });
      orguntsId = orguntsId.substring(0, orguntsId.length - 1);
      this.getUsersUnderLoggedInUserOrganisationUnit(orguntsId).subscribe((response) => {

        this.loadingInformation = 'Loading users  successfully';
        this.userTable = {...this.userTable, headers: this.prepareHeaders()};
        this.userTable = {...this.userTable, rows: this.prepareRows(response)};
        this.setPage(this.currentPage);
      }, (error) => {

      });
    }, () => {

    });
  }

  ngOnChanges() {
    this.setPage(this.currentPage);
  }

  setPage(page: number) {
    if (this.userTable) {
// get pager object from service
      this.pager = this.pagerService.getPager(this.userTable.rows.length, page, this.pageSize);
      this.pageSizeChanger[3].count = this.userTable.rows.length;
      // get current page of items
      this.pagedItems = this.userTable.rows.slice(this.pager.startIndex, this.pager.endIndex + 1);
    }

  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setPage(this.currentPage);
    }
  }

  nextPage() {
    if (this.currentPage < this.pager.totalPages) {
      this.currentPage++;
      this.setPage(this.currentPage);
    }
  }

  changePageSize(pageSize) {
    this.pageSizeChanger = this.pageSizeChanger.map(pager => {
      // pageSize.item = pager.item ? pager.className = 'active' : pager.className = '';
      pager.className = '';
      if (pager.item === pageSize.item) {
        pager.className = 'active';
        this.pageSize = pager.count;
      }
      return pager;
    });
    this.setPage(1);
  }


  getCurrentLoggenUser(): Observable<any> {
    return this.http.get('me.json');
  }

  prepareHeaders() {
    return [
      'S/N',
      'Full Name',
      'Username',
      'Email address',
      'Phone number',
      'Assigned organisation unit',
      'Assigned role',
      'Last login',
      'Status'
    ];
  }

  prepareRows(users) {
    let usersList = [];
    users.forEach((user) => {
      usersList = [...usersList,
        {
          columns: this.getColumns(user)
        }
      ];
    })
    return usersList;
  }

  getColumns(user) {
    return [
      user.name,
      user.userCredentials.username,
      user.email ? user.email : 'None',
      user.phoneNumber ? user.phoneNumber : 'None',
      this.getOrganisationUnits(user.organisationUnits),
      this.getUserRoles(user.userCredentials.userRoles),
      !user.userCredentials.lastLogin ? 'Never' : user.userCredentials.lastLogin,
      user.userCredentials.disable ? 'Inactive' : 'Active'
    ];
  }

  getOrganisationUnits(organisationUnits) {
    let orgunitName = '';
    organisationUnits.forEach((organisationUnit) => {
      orgunitName += organisationUnit.name + ',';
    });
    orgunitName = orgunitName === '' ? 'None' : orgunitName.substr(0, orgunitName.length - 1);
    return orgunitName;
  }

  getUserRoles(roles) {
    let roleString = '';
    roles.forEach((role) => {
      roleString += role.name + ',';
    });
    roleString = roleString === '' ? 'None' : roleString.substr(0, roleString.length - 1);
    return roleString;
  }

  getUsersUnderLoggedInUserOrganisationUnit(orgUnit): Observable<any> {

    return Observable.create((observer) => {
        this.getFromIndexDB().subscribe((usersIndexDB) => {
          if (!usersIndexDB || usersIndexDB.length === 0) {
            this.http.get('users.json?fields=:all,userCredentials[username,disabled,lastLogin,userRoles[id,name,displayName]],organisationUnits[id,name,level]&paging=false&organisationUnits.level:in:[1,2,3]')
              .subscribe((usersFromApi) => {
                this.postToIndexDB(usersFromApi.users).subscribe((indexDBUsers) => {
                  observer.next(usersFromApi.users);
                  observer.complete();
                }, (indexDBError) => {
                  observer.error(indexDBError);
                  observer.complete();
                });
              }, (errors) => {
                observer.error(errors);
                observer.complete();
              });
          } else {
            observer.next(usersIndexDB);
            observer.complete();
          }

        }, (error) => {
          observer.error(error);
          observer.complete();
        });
      }
    );
  }

  postToIndexDB(users): Observable<any> {
    const usersListObservable = [];

    users.forEach((user) => {
      usersListObservable.push(this.indexDBService.post(this.userSchema, user));
    });

    return Observable.create(
      (observer: any) => {
        this.indexDBService.create(this.userSchema).subscribe((status) => {

          const observableObject = forkJoin(usersListObservable);
          observableObject.subscribe((usersListResponse) => {
            observer.next(usersListResponse);
            observer.complete();
          }, (usersListError) => {
              observer.error(usersListError);
              observer.complete();
          });
        }, (error) => {
          console.log(error);
        });
      }
    );

  }

  getFromIndexDB(): Observable<any> {
    return Observable.create((observer) => {
      this.indexDBService.select(this.userSchema).subscribe((users) => {
        observer.next(users);
        observer.complete();
      }, (error) => {
        observer.error(error);
        observer.complete();
      });
    });
  }

  downloadExel() {
    // const ctx = {worksheet: 'Sheet 1'},
    //   base64 = s => window.btoa(unescape(encodeURIComponent(s))),
    //   format = (s, c) => s.replace(/{(\w+)}/g, (m, p) => c[p]);
    //
    // let str =
    //   '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office' +
    //   ':excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook>' +
    //   '<x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/>' +
    //   '</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
    // str += $('#usersList').html() + '</body></html>';
    //
    // setTimeout(() => {
    //   const link = document.createElement('a');
    //   link.download = 'Distribution point users list.xls';
    //   link.href =
    //     'data:application/vnd.ms-excel;base64,' + base64(format(str, ctx));
    //   link.click();
    // }, 100);


    const uri = 'data:application/vnd.ms-excel;base64,'
      ,
      tmplWorkbookXML = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        + '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>Axel Richter</Author><Created>{created}</Created></DocumentProperties>'
        + '<Styles>'
        + '<Style ss:ID="Currency"><NumberFormat ss:Format="Currency"></NumberFormat></Style>'
        + '<Style ss:ID="Date"><NumberFormat ss:Format="Medium Date"></NumberFormat></Style>'
        + '</Styles>'
        + '{worksheets}</Workbook>'
      , tmplWorksheetXML = '<Worksheet ss:Name="{nameWS}"><Table>{rows}</Table></Worksheet>'
      , tmplCellXML = '<Cell{attributeStyleID}{attributeFormula}><Data ss:Type="{nameType}">{data}</Data></Cell>'
      , base64 = function (s) {
        return window.btoa(unescape(encodeURIComponent(s)));
      }
      , format = (s, c) => {
        return s.replace(/{(\w+)}/g, function (m, p) {
          return c[p];
        });
      }
    return (tables, wsnames, wbname, appname) => {
      let ctx: any = '';
      let workbookXML: any = '';
      let worksheetsXML: any = '';
      let rowsXML: any = '';

      for (let i = 0; i < tables.length; i++) {
        if (!tables[i].nodeType) {
          tables[i] = document.getElementById(tables[i])
        }
        ;
        for (let j = 0; j < tables[i].rows.length; j++) {
          rowsXML += '<Row>'
          for (let k = 0; k < tables[i].rows[j].cells.length; k++) {
            const dataType = tables[i].rows[j].cells[k].getAttribute('data-type');
            const dataStyle = tables[i].rows[j].cells[k].getAttribute('data-style');
            let dataValue = tables[i].rows[j].cells[k].getAttribute('data-value');
            dataValue = (dataValue) ? dataValue : tables[i].rows[j].cells[k].innerHTML;
            let dataFormula = tables[i].rows[j].cells[k].getAttribute('data-formula');
            dataFormula = (dataFormula) ? dataFormula : (appname === 'Calc' && dataType === 'DateTime') ? dataValue : null;
            ctx = {
              attributeStyleID: (dataStyle === 'Currency' || dataStyle === 'Date') ? ' ss:StyleID="' + dataStyle + '"' : ''
              ,
              nameType: (dataType === 'Number' || dataType === 'DateTime' || dataType === 'Boolean' || dataType === 'Error') ? dataType : 'String'
              ,
              data: (dataFormula) ? '' : dataValue
              ,
              attributeFormula: (dataFormula) ? ' ss:Formula="' + dataFormula + '"' : ''
            };
            rowsXML += format(tmplCellXML, ctx);
          }
          rowsXML += '</Row>';
        }
        ctx = {rows: rowsXML, nameWS: wsnames[i] || 'Sheet' + i};
        worksheetsXML += format(tmplWorksheetXML, ctx);
        rowsXML = '';
      }

      ctx = {created: (new Date()).getTime(), worksheets: worksheetsXML};
      workbookXML = format(tmplWorkbookXML, ctx);


      const link: any = document.createElement('A');
      link.href = uri + base64(workbookXML);
      link.download = wbname || 'Workbook.xls';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

  }

  downloadPDF() {
    console.log($);
    console.log(kendo);
    kendo.drawing
      .drawDOM('#printable',
        {
          paperSize: 'A4',
          margin: {top: '1cm', bottom: '1cm'},
          scale: 0.8,
          height: 500
        })
      .then(function (group) {
        kendo.drawing.pdf.saveAs(group, 'Exported.pdf');
      });

  }
}
